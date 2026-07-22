import { Prose } from "@kanzo-tech/ui";

/**
 * Prose styles a tree of elements you did NOT author — here written as JSX for the example,
 * but in practice the output of a markdown renderer or a CMS. Nothing inside carries a class.
 */
export default function Example() {
  return (
    <Prose>
      <h2>Dataset conventions</h2>
      <p>
        Every dataset in the catalogue carries a <code>dct:title</code> and a{" "}
        <code>dct:issued</code> date. Keywords are optional but strongly encouraged — they are
        what makes a dataset findable through search rather than through browsing.
      </p>
      <blockquote>
        A dataset without keywords is a dataset nobody will find twice.
      </blockquote>
      <h3>Required fields</h3>
      <ul>
        <li>
          <strong>Title</strong> — human readable, no file extensions.
        </li>
        <li>
          <strong>Issued</strong> — ISO 8601, date only.
        </li>
        <li>
          <a href="#">Publisher</a> — an IRI, not a display name.
        </li>
      </ul>
    </Prose>
  );
}
