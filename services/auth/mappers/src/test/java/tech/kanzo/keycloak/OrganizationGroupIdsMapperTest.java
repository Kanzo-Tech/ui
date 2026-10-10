package tech.kanzo.keycloak;

import java.lang.reflect.Proxy;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.keycloak.models.GroupModel;
import org.keycloak.models.ProtocolMapperModel;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The decisions, without a Keycloak. The mapper's wiring into a token — which organizations, on
 * which tokens, after an exchange — is proved on a live realm by ../../scripts/verify.sh.
 */
class OrganizationGroupIdsMapperTest {

    /** A group tree as parent links: id -> parent id (absent at the top). */
    private static GroupIds.Result of(List<String> direct, Map<String, String> parents, boolean inherited, int threshold) {
        return GroupIds.of(direct, g -> g, parents::get, inherited, threshold);
    }

    private static final Map<String, String> TREE = Map.of("ml", "research", "nlp", "ml", "audit", "finance");

    @Test
    void carriesTheIdsOfTheGroupsTheMemberIsIn() {
        GroupIds.Result r = of(List.of("research", "finance"), Map.of(), true, 100);
        assertEquals(List.of("research", "finance"), r.ids());
        assertFalse(r.overage());
    }

    @Test
    void carriesEveryAncestorOfASubgroupWhenInherited() {
        assertEquals(List.of("nlp", "ml", "research"), of(List.of("nlp"), TREE, true, 100).ids());
    }

    @Test
    void carriesOnlyTheDirectGroupsWhenNotInherited() {
        assertEquals(List.of("nlp", "audit"), of(List.of("nlp", "audit"), TREE, false, 100).ids());
    }

    @Test
    void carriesAnAncestorSharedByTwoSubgroupsOnce() {
        assertEquals(List.of("nlp", "ml", "research"), of(List.of("nlp", "ml", "research"), TREE, true, 100).ids());
    }

    @Test
    void carriesExactlyTheThresholdAndNoMore() {
        GroupIds.Result atThreshold = of(List.of("a", "b"), Map.of(), true, 2);
        assertEquals(List.of("a", "b"), atThreshold.ids());
        assertFalse(atThreshold.overage());

        GroupIds.Result over = of(List.of("a", "b", "c"), Map.of(), true, 2);
        assertTrue(over.overage());
        assertEquals(List.of(), over.ids(), "an overage carries no ids: a partial list would deny in silence");
    }

    @Test
    void countsInheritedIdsTowardTheThreshold() {
        // One direct membership, three ids once the ancestors are in.
        assertTrue(of(List.of("nlp"), TREE, true, 2).overage());
        assertFalse(of(List.of("nlp"), TREE, false, 2).overage());
    }

    @Test
    void isEmptyAndNotOverageForAMemberOfNoGroup() {
        GroupIds.Result r = of(List.of(), Map.of(), true, 0);
        assertEquals(List.of(), r.ids());
        assertFalse(r.overage());
    }

    @Test
    void stopsAtTheOrganizationsInternalGroup() {
        // An organization's top-level groups hang under a group named by the organization's id.
        GroupModel internal = group("internal", "org-1", null);
        GroupModel research = group("research", "Research", internal);
        GroupModel ml = group("ml", "ML", research);

        assertSame(research, OrganizationGroupIdsMapper.parentWithin(ml, "org-1"));
        assertNull(OrganizationGroupIdsMapper.parentWithin(research, "org-1"));
        assertNull(OrganizationGroupIdsMapper.parentWithin(internal, "org-1"));
    }

    @Test
    void readsTheThresholdAndFallsBackOnNonsense() {
        assertEquals(100, OrganizationGroupIdsMapper.threshold(mapper(null)));
        assertEquals(100, OrganizationGroupIdsMapper.threshold(mapper("")));
        assertEquals(7, OrganizationGroupIdsMapper.threshold(mapper(" 7 ")));
        assertEquals(0, OrganizationGroupIdsMapper.threshold(mapper("0")));
        assertEquals(100, OrganizationGroupIdsMapper.threshold(mapper("-1")));
        assertEquals(100, OrganizationGroupIdsMapper.threshold(mapper("many")));
    }

    @Test
    void runsAfterKeycloaksOrganizationMappers() {
        // OrganizationMembershipMapper is 0 and OrganizationGroupMembershipMapper 10: this replaces the
        // paths the second one writes, so it must come after both.
        assertTrue(new OrganizationGroupIdsMapper().getPriority() > 10);
    }

    private static ProtocolMapperModel mapper(String threshold) {
        ProtocolMapperModel model = new ProtocolMapperModel();
        model.setName("organization-group-ids");
        Map<String, String> config = new HashMap<>();
        if (threshold != null) config.put(OrganizationGroupIdsMapper.OVERAGE_THRESHOLD, threshold);
        model.setConfig(config);
        return model;
    }

    /** A GroupModel answering id, name and parent; anything else is a test that reached too far. */
    private static GroupModel group(String id, String name, GroupModel parent) {
        return (GroupModel) Proxy.newProxyInstance(GroupModel.class.getClassLoader(), new Class<?>[]{GroupModel.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "getId" -> id;
                    case "getName" -> name;
                    case "getParent" -> parent;
                    case "hashCode" -> System.identityHashCode(proxy);
                    case "equals" -> proxy == args[0];
                    case "toString" -> name;
                    default -> throw new UnsupportedOperationException(method.getName());
                });
    }
}
