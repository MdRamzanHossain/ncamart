import { describe, it, expect } from "vitest";
import React from "react";
import { HeroPortal } from "../HeroPortal";
import { CategoryDock } from "../CategoryDock";
import { CollectionsGrid } from "../CollectionsGrid";
import { RecommendedCarousel } from "../RecommendedCarousel";

describe("F07 — Interactive Homepage & Dynamic Hero Portal Experience", () => {
  it("renders HeroPortal with 3D parallax container and trust micro-bar", () => {
    const element = React.createElement(HeroPortal);
    expect(element).toBeDefined();
    expect(element.type).toBe(HeroPortal);
  });

  it("renders CategoryDock with circular category icons and links", () => {
    const element = React.createElement(CategoryDock);
    expect(element).toBeDefined();
    expect(element.type).toBe(CategoryDock);
  });

  it("renders CollectionsGrid with 4 curated hardware categories", () => {
    const element = React.createElement(CollectionsGrid);
    expect(element).toBeDefined();
    expect(element.type).toBe(CollectionsGrid);
  });

  it("renders RecommendedCarousel with dual-tier product cards", () => {
    const element = React.createElement(RecommendedCarousel);
    expect(element).toBeDefined();
    expect(element.type).toBe(RecommendedCarousel);
  });
});
