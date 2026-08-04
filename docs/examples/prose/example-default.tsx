import { Prose } from "@kanzo-tech/ui";

/**
 * Prose styles a tree of elements you did NOT author — here written as JSX for the example,
 * but in practice the output of a markdown renderer or a CMS. Nothing inside carries a class.
 */
export default function Example() {
  return (
    <Prose>
      <h2>Posting a contract</h2>
      <p>
        Every contract on the board carries a <code>grade</code> and a <code>region</code>. Tags
        are optional but strongly encouraged — they are what lets a warden find the work she is
        equipped for rather than reading the board end to end.
      </p>
      <blockquote>
        A contract nobody tagged is a contract the right party never sees.
      </blockquote>
      <h3>Required fields</h3>
      <ul>
        <li>
          <strong>Title</strong> — what a scout would call it, not a case number.
        </li>
        <li>
          <strong>Due</strong> — a date the party can walk to and back from.
        </li>
        <li>
          <a href="#">Posting hall</a> — a charter, not a person's name.
        </li>
      </ul>
    </Prose>
  );
}
