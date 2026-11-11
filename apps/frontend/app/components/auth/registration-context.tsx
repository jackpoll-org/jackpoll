"use client";

import { createContext, useContext } from "react";

const RegistrationContext = createContext(true);

export function RegistrationProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  return <RegistrationContext.Provider value={enabled}>{children}</RegistrationContext.Provider>;
}

export function useRegistrationEnabled(): boolean {
  return useContext(RegistrationContext);
}
