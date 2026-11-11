import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/app/i18n/context", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock("@/app/components/auth/register-form", () => ({ RegisterForm: () => <form aria-label="register-form" /> }));
vi.mock("@/app/components/native/instance-box", () => ({ InstanceBox: () => null }));

import RegisterPage from "@/app/(routes)/(auth)/register/page";
import { RegistrationProvider } from "../registration-context";

describe("RegisterPage", () => {
  it("shows the form while registration is open", () => {
    render(<RegisterPage />);
    expect(screen.getByRole("form", { name: "register-form" })).toBeInTheDocument();
  });

  it("explains that registration is closed and offers sign-in", () => {
    render(
      <RegistrationProvider enabled={false}>
        <RegisterPage />
      </RegistrationProvider>,
    );
    expect(screen.queryByRole("form", { name: "register-form" })).toBeNull();
    expect(screen.getByText("auth.page.register.closedTitle")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "auth.signIn" })).toHaveAttribute("href", "/login");
  });
});
