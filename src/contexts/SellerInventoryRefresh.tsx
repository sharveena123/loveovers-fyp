import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type SellerInventoryRefreshContextValue = {
  refreshKey: number;
  notifyInventoryChanged: () => void;
};

const SellerInventoryRefreshContext =
  createContext<SellerInventoryRefreshContextValue | null>(null);

export function SellerInventoryRefreshProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const notifyInventoryChanged = useCallback(
    () => setRefreshKey((k) => k + 1),
    [],
  );

  const value = useMemo(
    () => ({ refreshKey, notifyInventoryChanged }),
    [refreshKey, notifyInventoryChanged],
  );

  return (
    <SellerInventoryRefreshContext.Provider value={value}>
      {children}
    </SellerInventoryRefreshContext.Provider>
  );
}

export function useSellerInventoryRefresh() {
  return useContext(SellerInventoryRefreshContext);
}
