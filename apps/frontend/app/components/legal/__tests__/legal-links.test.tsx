import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({ t: (k: string) => k, locale: "en" }),
}));

import { LegalLinks } from "../legal-links";
import { LegalFooter } from "../legal-footer";
import { InstanceLegalProvider } from "../instance-legal-context";

afterEach(cleanup);

const configured = {
  links: { imprint: "https://example.org/impressum", privacy: "/privacy", terms: "/terms" },
  operator: "Verein e.V.",
};

describe("LegalLinks", () => {
  it("renders nothing when the operator configured no legal pages", () => {
    const { container } = render(<LegalLinks />);
    expect(container).toBeEmptyDOMElement();
  });

  it("links to the configured pages", () => {
    render(
      <InstanceLegalProvider value={configured}>
        <LegalLinks />
      </InstanceLegalProvider>,
    );
    expect(screen.getByText("legal.imprint")).toHaveAttribute("href", "https://example.org/impressum");
    expect(screen.getByText("legal.privacy")).toHaveAttribute("href", "/privacy");
    expect(screen.getByText("legal.terms")).toHaveAttribute("href", "/terms");
  });
});

describe("LegalFooter", () => {
  it("renders nothing without configuration", () => {
    const { container } = render(<LegalFooter />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows configured links and the operator", () => {
    render(
      <InstanceLegalProvider value={configured}>
        <LegalFooter />
      </InstanceLegalProvider>,
    );
    expect(screen.getByText("legal.imprint")).toHaveAttribute("target", "_blank");
    expect(screen.getByText("legal.privacy")).not.toHaveAttribute("target");
    expect(screen.getByText(/Verein e\.V\./)).toBeInTheDocument();
  });
});
