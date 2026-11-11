"use client";

import { createContext, useContext } from "react";
import type { InstanceLegal } from "@/app/lib/legal/instance";

const InstanceLegalContext = createContext<InstanceLegal>({
  links: { imprint: null, privacy: null, terms: null },
  operator: null,
});

export function InstanceLegalProvider({
  value,
  children,
}: {
  value: InstanceLegal;
  children: React.ReactNode;
}) {
  return <InstanceLegalContext.Provider value={value}>{children}</InstanceLegalContext.Provider>;
}

export function useInstanceLegal(): InstanceLegal {
  return useContext(InstanceLegalContext);
}
