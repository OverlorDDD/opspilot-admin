import type {
  ConfigKeyType,
  ConfigValue,
} from "@opspilot/contracts";

export interface ConfigCatalogItem {
  name: string;
  type: ConfigKeyType;
  defaultValue: ConfigValue;
  description: string;
}

export const PROJECT_CONFIG_CATALOG: Record<string, ConfigCatalogItem[]> = {
  "flowline-service": [
    {
      name: "limits.maxTasksPerUser",
      type: "number",
      defaultValue: 25,
      description: "Maximum number of active tasks for one operations manager.",
    },
    {
      name: "service.maintenanceMode",
      type: "boolean",
      defaultValue: false,
      description: "Temporarily makes Dispatch read-only during maintenance.",
    },
    {
      name: "notifications.weeklyDigest",
      type: "boolean",
      defaultValue: true,
      description: "Controls whether operations can queue the weekly digest.",
    },
    {
      name: "limits.maxRetries",
      type: "number",
      defaultValue: 3,
      description: "Maximum retry count after the first failed carrier request.",
    },
  ],
  "flowline-customer-portal": [
    {
      name: "portal.selfServiceReturns",
      type: "boolean",
      defaultValue: true,
      description: "Enables the self-service return flow in the customer portal.",
    },
    {
      name: "portal.maxOpenTickets",
      type: "number",
      defaultValue: 5,
      description: "Maximum number of open support tickets per customer.",
    },
    {
      name: "portal.maintenanceMode",
      type: "boolean",
      defaultValue: false,
      description: "Puts the customer portal into a read-only maintenance state.",
    },
  ],
};

export function getProjectConfigCatalog(
  projectId: string,
): ConfigCatalogItem[] {
  return PROJECT_CONFIG_CATALOG[projectId] ?? [];
}

export function findProjectConfigDefinition(
  projectId: string,
  name: string,
): ConfigCatalogItem | undefined {
  return getProjectConfigCatalog(projectId).find(
    (item) => item.name === name,
  );
}
