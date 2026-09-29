import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EntityRow } from "./entity-row";

describe("EntityRow", () => {
  it("shows an ISRC action only for a recording", () => {
    const { rerender } = render(<EntityRow kind="song" name="Synthetic fixture" subtitle="Test artist" isrc="USRC17607839" />);
    expect(screen.getByRole("button", { name: /copy isrc:USRC17607839/i })).toBeInTheDocument();

    rerender(<EntityRow kind="album" name="Synthetic album" subtitle="Test artist" href="/albums/1234567890123456789012" />);
    expect(screen.getByRole("link", { name: "Open album Synthetic album" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /copy/i })).not.toBeInTheDocument();
  });

  it("renders a song title as plain text, not a Spotify link", () => {
    render(
      <EntityRow
        kind="song"
        name="Synthetic fixture"
        subtitle="Test artist"
        isrc="USRC17607839"
      />,
    );
    expect(screen.getByText("Synthetic fixture")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Synthetic fixture" })).not.toBeInTheDocument();
  });
});
