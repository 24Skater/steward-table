export const DEFAULT_KITCHEN_NAME = "Main Kitchen";
export const DEFAULT_KITCHEN_SLUG = "main";

/**
 * Minimal shape needed to create a kitchen. Satisfied by both the extended
 * `db` client and a `$transaction` callback's `tx` client.
 */
interface KitchenCreateClient {
  kitchen: {
    create: (args: {
      data: {
        churchId: string;
        name: string;
        slug: string;
        isDefault: boolean;
      };
    }) => Promise<unknown>;
  };
}

/**
 * Create the default "Main Kitchen" for a church. Every church must have exactly
 * one default kitchen; call this during church provisioning and backfill.
 */
export async function createDefaultKitchen<T>(
  client: KitchenCreateClient,
  churchId: string,
): Promise<T> {
  return client.kitchen.create({
    data: {
      churchId,
      name: DEFAULT_KITCHEN_NAME,
      slug: DEFAULT_KITCHEN_SLUG,
      isDefault: true,
    },
  }) as Promise<T>;
}
