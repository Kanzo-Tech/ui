"use client";

import {
  Rating,
  RatingContext,
  RatingControl,
  RatingItem,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Rating count={5} defaultValue={3}>
      <RatingControl>
        <RatingContext>
          {(api) =>
            api.items.map((index) => <RatingItem index={index} key={index} />)
          }
        </RatingContext>
      </RatingControl>
    </Rating>
  );
}
