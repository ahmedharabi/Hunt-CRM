"use client";

import {
  columnFacetingFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  constructFilterFn,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  metaHelper,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table";

export type ColumnMeta = {
  /** Label in the column-visibility menu. */
  label?: string;
  /** Extra classes for both th and td. */
  className?: string;
  align?: "start" | "end";
};

/** Row value is one of the selected facet values. Empty selection removes the filter. */
const inSet = constructFilterFn({
  filter: (dataValue: unknown, filterValue: string[]) => filterValue.includes(String(dataValue)),
  autoRemove: (v: unknown) => !Array.isArray(v) || v.length === 0,
});

/** Row value (an array) shares at least one element with the selected values. */
const arrIncludesSome = constructFilterFn({
  filter: (dataValue: unknown, filterValue: string[]) =>
    Array.isArray(dataValue) && dataValue.some((v) => filterValue.includes(String(v))),
  autoRemove: (v: unknown) => !Array.isArray(v) || v.length === 0,
});

/** The one feature set every table in the app shares. */
export const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  columnVisibilityFeature,
  columnFacetingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  filterFns: { includesString: filterFn_includesString, inSet, arrIncludesSome },
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic, datetime: sortFn_datetime, text: sortFn_text },
  columnMeta: metaHelper<ColumnMeta>(),
});
export type Features = typeof features;

export type TableViewState = {
  globalFilter?: string;
  columnFilters?: { id: string; value: unknown }[];
  sorting?: { id: string; desc: boolean }[];
  columnVisibility?: Record<string, boolean>;
};
