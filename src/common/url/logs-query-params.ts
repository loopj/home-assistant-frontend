import {
  decodeQueryParams,
  type QueryParamConfig,
  type QueryParamValues,
  type SearchParamsSource,
} from "./query-params";

// `filter` is the name the search had before, still read until 2027.5. It is
// in the configs so writing the search replaces it.
export const logSearchQueryParamConfig = {
  string: ["search", "filter"],
} as const satisfies QueryParamConfig;

export const logsQueryParamConfig = {
  string: ["provider", "search", "filter"],
  boolean: [{ key: "raw", trueValue: "1" }],
} as const satisfies QueryParamConfig;

export type LogsQueryParams = QueryParamValues<typeof logsQueryParamConfig>;

export const DEFAULT_LOG_PROVIDER = "core";

export const logSearchFromUrl = (searchParams: SearchParamsSource): string => {
  const { search, filter } = decodeQueryParams(
    searchParams,
    logSearchQueryParamConfig
  );

  return search ?? filter ?? "";
};

export const logProviderFromUrl = (searchParams: SearchParamsSource): string =>
  decodeQueryParams(searchParams, logsQueryParamConfig).provider ??
  DEFAULT_LOG_PROVIDER;

export const logRawFromUrl = (searchParams: SearchParamsSource): boolean =>
  decodeQueryParams(searchParams, logsQueryParamConfig).raw ?? false;

/**
 * Params for the logs page. The default provider and no search are left out,
 * and raw only applies to Core, the other providers only have raw logs.
 */
export const logsQueryParamsFromState = (
  provider: string,
  search: string,
  raw = false
): LogsQueryParams => ({
  provider: provider === DEFAULT_LOG_PROVIDER ? undefined : provider,
  search,
  raw: provider === DEFAULT_LOG_PROVIDER && raw,
});
