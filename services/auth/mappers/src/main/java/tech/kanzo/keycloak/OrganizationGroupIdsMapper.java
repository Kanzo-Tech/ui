package tech.kanzo.keycloak;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.node.ObjectNode;
import org.jboss.logging.Logger;
import org.keycloak.Config;
import org.keycloak.common.Profile;
import org.keycloak.models.ClientSessionContext;
import org.keycloak.models.GroupModel;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.OrganizationModel;
import org.keycloak.models.ProtocolMapperModel;
import org.keycloak.models.UserModel;
import org.keycloak.models.UserSessionModel;
import org.keycloak.organization.OrganizationProvider;
import org.keycloak.organization.protocol.mappers.oidc.OrganizationMembershipMapper;
import org.keycloak.organization.utils.Organizations;
import org.keycloak.protocol.oidc.mappers.AbstractOIDCProtocolMapper;
import org.keycloak.protocol.oidc.mappers.OIDCAccessTokenMapper;
import org.keycloak.protocol.oidc.mappers.OIDCAttributeMapperHelper;
import org.keycloak.protocol.oidc.mappers.OIDCIDTokenMapper;
import org.keycloak.protocol.oidc.mappers.TokenIntrospectionTokenMapper;
import org.keycloak.protocol.oidc.mappers.UserInfoTokenMapper;
import org.keycloak.provider.EnvironmentDependentProviderFactory;
import org.keycloak.provider.ProviderConfigProperty;
import org.keycloak.representations.IDToken;
import org.keycloak.util.JsonSerialization;

/**
 * Writes the <strong>ids</strong> of the person's organization groups into each entry of the
 * {@code organization} claim:
 *
 * <pre>
 * "organization": { "acme": { "id": "…", "groups": ["&lt;group id&gt;", …], … } }
 * </pre>
 *
 * or, above the overage threshold, {@code "groups_overage": true} and no ids — Microsoft Entra ID's
 * groups claim, ids and overage both, inside each organization.
 *
 * <p>Keycloak's own Organization Group Membership mapper (priority 10) writes group <em>paths</em>
 * under {@code groups}, and paths are names: the organization's to change. This mapper runs after
 * it and replaces them, and leaves the {@code resource_access} that mapper writes alone. It writes
 * only into entries the Organization Membership mapper already wrote, so which organizations a
 * token names — all of them for {@code organization:*}, one after an exchange — stays Keycloak's
 * decision, and a person in none gets no claim at all.
 */
public class OrganizationGroupIdsMapper extends AbstractOIDCProtocolMapper
        implements OIDCAccessTokenMapper, OIDCIDTokenMapper, UserInfoTokenMapper, TokenIntrospectionTokenMapper,
        EnvironmentDependentProviderFactory {

    public static final String PROVIDER_ID = "kanzo-organization-group-ids-mapper";
    public static final String INHERITED = "inheritedGroups";
    public static final String OVERAGE_THRESHOLD = "overageThreshold";
    static final int DEFAULT_OVERAGE_THRESHOLD = 100;

    private static final Logger LOG = Logger.getLogger(OrganizationGroupIdsMapper.class);

    @Override
    public List<ProviderConfigProperty> getConfigProperties() {
        List<ProviderConfigProperty> properties = new ArrayList<>();
        OIDCAttributeMapperHelper.addIncludeInTokensConfig(properties, OrganizationGroupIdsMapper.class);

        ProviderConfigProperty inherited = new ProviderConfigProperty();
        inherited.setName(INHERITED);
        inherited.setLabel("Include ancestor groups");
        inherited.setHelpText("A member of a subgroup also carries the ids of the groups above it in the organization"
                + " (a member of Research/ML carries Research's id too).");
        inherited.setType(ProviderConfigProperty.BOOLEAN_TYPE);
        inherited.setDefaultValue("true");
        properties.add(inherited);

        ProviderConfigProperty threshold = new ProviderConfigProperty();
        threshold.setName(OVERAGE_THRESHOLD);
        threshold.setLabel("Overage threshold");
        threshold.setHelpText("The most group ids one organization entry carries. Above it the entry carries"
                + " groups_overage: true and no ids, and the application reads membership from the admin API.");
        threshold.setType(ProviderConfigProperty.STRING_TYPE);
        threshold.setDefaultValue(String.valueOf(DEFAULT_OVERAGE_THRESHOLD));
        properties.add(threshold);
        return properties;
    }

    @Override
    public String getId() {
        return PROVIDER_ID;
    }

    @Override
    public String getDisplayType() {
        return "Organization Group Ids";
    }

    @Override
    public String getDisplayCategory() {
        return TOKEN_MAPPER_CATEGORY;
    }

    @Override
    public String getHelpText() {
        return "The ids of the user's groups in each organization of the organization claim, with an overage rule.";
    }

    @Override
    public int getPriority() {
        // After OrganizationMembershipMapper (0), which writes the entries, and
        // OrganizationGroupMembershipMapper (10), whose `groups` paths this replaces.
        return 20;
    }

    @Override
    public boolean isSupported(Config.Scope config) {
        return Profile.isFeatureEnabled(Profile.Feature.ORGANIZATION);
    }

    @Override
    protected void setClaim(IDToken token, ProtocolMapperModel model, UserSessionModel userSession,
                            KeycloakSession session, ClientSessionContext clientSessionCtx) {
        if (!Organizations.isEnabled(session)) return;

        String claimName = clientSessionCtx.getProtocolMappersStream()
                .filter(m -> OrganizationMembershipMapper.PROVIDER_ID.equals(m.getProtocolMapper()))
                .map(m -> m.getConfig().get(OIDCAttributeMapperHelper.TOKEN_CLAIM_NAME))
                .findAny()
                .orElse(null);
        if (claimName == null) return; // no organization scope in this request: nothing to fill

        Map<String, Object> entries = entries(token.getOtherClaims().get(claimName));
        if (entries == null) return; // a person in no organization has no claim, and gets none

        boolean inherited = Boolean.parseBoolean(model.getConfig().getOrDefault(INHERITED, "true"));
        int threshold = threshold(model);
        OrganizationProvider provider = session.getProvider(OrganizationProvider.class);
        UserModel user = userSession.getUser();

        Map<String, Object> written = new LinkedHashMap<>();
        entries.forEach((alias, value) -> {
            Map<String, Object> entry = value instanceof Map<?, ?> m ? copy(m) : new LinkedHashMap<>();
            OrganizationModel organization = provider.getByAlias(alias);
            if (organization != null && organization.isMember(user)) {
                String orgId = organization.getId();
                GroupIds.Result result = GroupIds.of(
                        provider.getOrganizationGroupsByMember(organization, user).toList(),
                        GroupModel::getId,
                        group -> parentWithin(group, orgId),
                        inherited,
                        threshold);
                entry.remove("groups");
                entry.remove("groups_overage");
                if (result.overage()) entry.put("groups_overage", true);
                else entry.put("groups", result.ids());
            }
            written.put(alias, entry);
        });
        token.getOtherClaims().put(claimName, written);
    }

    /**
     * The group above {@code group} in its organization, or {@code null} at the top. An
     * organization's groups hang under an internal group named by the organization's id; this stops
     * there, as {@code KeycloakModelUtils.buildGroupPath} does.
     */
    static GroupModel parentWithin(GroupModel group, String organizationId) {
        GroupModel parent = group.getParent();
        return parent == null || organizationId.equals(parent.getName()) ? null : parent;
    }

    /** The claim as the membership mapper left it — a JSON object, a map, or bare aliases — as a map. */
    @SuppressWarnings("unchecked")
    private static Map<String, Object> entries(Object claim) {
        if (claim instanceof ObjectNode node) return JsonSerialization.mapper.convertValue(node, Map.class);
        if (claim instanceof Map<?, ?> map) return (Map<String, Object>) map;
        if (claim instanceof Collection<?> aliases) {
            Map<String, Object> result = new LinkedHashMap<>();
            aliases.forEach(a -> result.put(String.valueOf(a), new LinkedHashMap<>()));
            return result;
        }
        return null;
    }

    private static Map<String, Object> copy(Map<?, ?> map) {
        Map<String, Object> result = new LinkedHashMap<>();
        map.forEach((k, v) -> result.put(String.valueOf(k), v));
        return result;
    }

    static int threshold(ProtocolMapperModel model) {
        String raw = model.getConfig().get(OVERAGE_THRESHOLD);
        if (raw == null || raw.isBlank()) return DEFAULT_OVERAGE_THRESHOLD;
        try {
            int value = Integer.parseInt(raw.trim());
            if (value >= 0) return value;
        } catch (NumberFormatException ignored) {
            // fall through
        }
        LOG.warnf("%s: overageThreshold '%s' is not a non-negative integer; using %d",
                model.getName(), raw, DEFAULT_OVERAGE_THRESHOLD);
        return DEFAULT_OVERAGE_THRESHOLD;
    }
}
