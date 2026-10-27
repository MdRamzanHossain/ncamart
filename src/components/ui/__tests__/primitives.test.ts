import { describe, it, expect } from "vitest";
import React from "react";
import {
  Button,
  Input,
  Textarea,
  MoneyInput,
  Badge,
  AuthenticBadge,
  BudgetSmartBadge,
  Dialog,
  Drawer,
  Skeleton,
  Tooltip,
  ToastProvider,
  useToast,
} from "../index";

describe("F02 — Base UI Component Primitive Library", () => {
  it("exports all UI primitive components cleanly", () => {
    expect(Button).toBeDefined();
    expect(Input).toBeDefined();
    expect(Textarea).toBeDefined();
    expect(MoneyInput).toBeDefined();
    expect(Badge).toBeDefined();
    expect(AuthenticBadge).toBeDefined();
    expect(BudgetSmartBadge).toBeDefined();
    expect(Dialog).toBeDefined();
    expect(Drawer).toBeDefined();
    expect(Skeleton).toBeDefined();
    expect(Tooltip).toBeDefined();
    expect(ToastProvider).toBeDefined();
    expect(useToast).toBeDefined();
  });

  it("creates React elements with expected props without throwing", () => {
    const btnElem = React.createElement(Button, { variant: "authentic-gold" }, "Click Me");
    expect(btnElem.type).toBe(Button);
    expect(btnElem.props.variant).toBe("authentic-gold");

    const inputElem = React.createElement(Input, { label: "Phone", defaultValue: "017" });
    expect(inputElem.type).toBe(Input);
    expect(inputElem.props.label).toBe("Phone");

    const moneyElem = React.createElement(MoneyInput, { paisaValue: 50000 });
    expect(moneyElem.type).toBe(MoneyInput);

    const authBadgeElem = React.createElement(AuthenticBadge, { size: "sm" });
    expect(authBadgeElem.type).toBe(AuthenticBadge);

    const dialogElem = React.createElement(Dialog, { isOpen: false, onClose: () => {} }, "Modal");
    expect(dialogElem.type).toBe(Dialog);

    const drawerElem = React.createElement(Drawer, { isOpen: false, onClose: () => {} }, "Drawer");
    expect(drawerElem.type).toBe(Drawer);

    const skelElem = React.createElement(Skeleton, { variant: "card" });
    expect(skelElem.type).toBe(Skeleton);
  });
});
