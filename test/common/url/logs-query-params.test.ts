import { describe, expect, it } from "vitest";

import {
  logProviderFromUrl,
  logRawFromUrl,
  logSearchFromUrl,
  logsQueryParamConfig,
  logsQueryParamsFromState,
} from "../../../src/common/url/logs-query-params";
import { updateQueryString } from "../../../src/common/url/query-params";

describe("logSearchFromUrl", () => {
  it("reads search, then the old filter name", () => {
    expect(logSearchFromUrl("?search=zwave_js")).toBe("zwave_js");
    expect(logSearchFromUrl("?filter=zwave_js")).toBe("zwave_js");
    expect(logSearchFromUrl("?search=new&filter=old")).toBe("new");
    expect(logSearchFromUrl("")).toBe("");
  });
});

describe("logProviderFromUrl", () => {
  it("defaults to Core", () => {
    expect(logProviderFromUrl("?provider=supervisor")).toBe("supervisor");
    expect(logProviderFromUrl("?search=x")).toBe("core");
  });
});

describe("logsQueryParamsFromState", () => {
  it("leaves out Core and an empty search, and replaces filter", () => {
    expect(
      updateQueryString(
        "?filter=old&other=1",
        logsQueryParamsFromState("core", "old"),
        logsQueryParamConfig
      )
    ).toBe("other=1&search=old");
    expect(
      updateQueryString(
        "?provider=dns&search=x",
        logsQueryParamsFromState("core", ""),
        logsQueryParamConfig
      )
    ).toBe("");
  });

  it("only writes raw for Core", () => {
    expect(
      updateQueryString(
        "",
        logsQueryParamsFromState("core", "", true),
        logsQueryParamConfig
      )
    ).toBe("raw=1");
    expect(
      updateQueryString(
        "?raw=1",
        logsQueryParamsFromState("supervisor", "", true),
        logsQueryParamConfig
      )
    ).toBe("provider=supervisor");
    expect(logRawFromUrl("?raw=1")).toBe(true);
    expect(logRawFromUrl("?raw=true")).toBe(false);
  });
});
