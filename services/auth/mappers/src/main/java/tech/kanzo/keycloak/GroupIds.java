package tech.kanzo.keycloak;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Function;

/**
 * What one organization's entry says about the person's groups there, decided without Keycloak:
 * the groups in, how to read an id and a parent, and the two settings. The mapper is the Keycloak
 * half; this is the half a unit test can reach.
 *
 * <p>The overage rule is Microsoft Entra ID's: above the threshold the token carries no ids at all
 * and says so, and the application asks the directory. Truncating instead would be a silent
 * denial — a grant to a group the token happened to leave out.
 */
final class GroupIds {

    /** Either the ids, in first-seen order, or overage and none. */
    record Result(List<String> ids, boolean overage) {
        static Result overageOf() {
            return new Result(List.of(), true);
        }
    }

    private GroupIds() {
    }

    /**
     * @param direct    the groups the person is a member of, in this organization
     * @param id        a group's id
     * @param parent    a group's parent <em>in this organization</em>, or {@code null} at its top
     * @param inherited whether a member of a subgroup also carries its ancestors' ids
     * @param threshold the most ids an entry carries; more is an overage
     */
    static <G> Result of(Iterable<G> direct, Function<G, String> id, Function<G, G> parent,
                         boolean inherited, int threshold) {
        Set<String> ids = new LinkedHashSet<>();
        for (G group : direct) {
            for (G g = group; g != null; g = inherited ? parent.apply(g) : null) {
                if (!ids.add(id.apply(g))) break; // the rest of this chain is already in
                if (ids.size() > threshold) return Result.overageOf();
            }
        }
        return new Result(new ArrayList<>(ids), false);
    }
}
