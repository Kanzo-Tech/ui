"use client";

import {
  Pagination,
  PaginationEllipsis,
  PaginationItem,
  PaginationNextTrigger,
  PaginationPrevTrigger,
  usePagination,
} from "@kanzo-tech/ui";

function Pages() {
  const pagination = usePagination();

  return (
    <>
      {pagination.pages.map((page, index) =>
        page.type === "page" ? (
          <PaginationItem key={page.value} type="page" value={page.value}>
            {page.value}
          </PaginationItem>
        ) : (
          <PaginationEllipsis key={`ellipsis-${index}`} index={index} />
        )
      )}
    </>
  );
}

export default function Example() {
  return (
    <Pagination count={100} defaultPage={3} pageSize={10} siblingCount={1}>
      <PaginationPrevTrigger />
      <Pages />
      <PaginationNextTrigger />
    </Pagination>
  );
}
