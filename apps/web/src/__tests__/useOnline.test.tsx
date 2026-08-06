import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useOnline } from "../useOnline";

function setOnLine(value: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(value);
}

function Probe() {
  const online = useOnline();
  return <p>{online ? "online" : "offline"}</p>;
}

describe("useOnline", () => {
  it("reflete navigator.onLine e reage aos eventos online/offline", () => {
    setOnLine(true);
    render(<Probe />);
    expect(screen.getByText("online")).toBeTruthy();

    act(() => {
      setOnLine(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByText("offline")).toBeTruthy();

    act(() => {
      setOnLine(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.getByText("online")).toBeTruthy();

    vi.restoreAllMocks();
  });
});
