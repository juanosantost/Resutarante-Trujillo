import type {
  Order,
  OrderItemDestination,
  OrderType,
  RoundDestinationInput,
  RoundDestinationScope,
  Table,
} from '../types';

export interface ResolvedRoundDestination {
  valid: boolean;
  error?: string;
  scope: RoundDestinationScope;
  destination: OrderItemDestination;
  isDifferentFromOrder: boolean;
  selectedTable?: Table | null;
}

export function formatDestinationTypeName(type: OrderType): string {
  switch (type) {
    case 'mesa':
      return 'Mesa';
    case 'mostrador':
      return 'Mostrador';
    case 'para_llevar':
      return 'Para Llevar';
    case 'domicilio':
      return 'Domicilio';
    default:
      return 'Pedido';
  }
}

export function formatOrderDestinationLabel(
  order: Pick<Order, 'type' | 'tableName' | 'customerAddress' | 'customerName'>
): string {
  if (order.type === 'mesa') {
    return (order.tableName || 'Mesa').trim();
  }
  if (order.type === 'domicilio') {
    const addr = (order.customerAddress || '').trim();
    return addr ? `Domicilio · ${addr}` : 'Domicilio';
  }
  if (order.type === 'mostrador') {
    const name = (order.customerName || '').trim();
    return name && name.toLowerCase() !== 'cliente general'
      ? `Mostrador · ${name}`
      : 'Mostrador';
  }
  const name = (order.customerName || '').trim();
  return name && name.toLowerCase() !== 'cliente general'
    ? `Para Llevar · ${name}`
    : 'Para Llevar';
}

export function resolveRoundDestination(params: {
  order: Pick<
    Order,
    'id' | 'type' | 'tableId' | 'tableName' | 'customerName' | 'customerPhone' | 'customerAddress'
  >;
  input?: RoundDestinationInput;
  tables: Table[];
}): ResolvedRoundDestination {
  const { order, input, tables } = params;
  const baseDestination: OrderItemDestination = {
    type: order.type,
    label: formatOrderDestinationLabel(order),
    tableId: order.tableId || null,
    tableName: order.tableName || null,
    customerName: order.customerName?.trim() || undefined,
    customerPhone: order.customerPhone?.trim() || undefined,
    customerAddress: order.customerAddress?.trim() || undefined,
  };

  if (!input || input.scope === 'mismo_lugar') {
    return {
      valid: true,
      scope: 'mismo_lugar',
      destination: baseDestination,
      isDifferentFromOrder: false,
      selectedTable: order.tableId ? tables.find((t) => t.id === order.tableId) || null : null,
    };
  }

  const targetType: OrderType = input.type || order.type;
  const cleanName = (input.customerName || '').trim();
  const cleanPhone = (input.customerPhone || '').trim();
  const cleanAddress = (input.customerAddress || '').trim();

  if (targetType === 'mesa') {
    const tableId = (input.tableId || '').trim();
    if (!tableId) {
      return {
        valid: false,
        error: 'Selecciona la mesa de destino para estos productos.',
        scope: input.scope,
        destination: baseDestination,
        isDifferentFromOrder: false,
      };
    }

    const targetTable = tables.find((t) => t.id === tableId);
    if (!targetTable) {
      return {
        valid: false,
        error: 'La mesa seleccionada no existe o no está disponible.',
        scope: input.scope,
        destination: baseDestination,
        isDifferentFromOrder: false,
      };
    }

    if (
      input.scope === 'cambiar_pedido' &&
      targetTable.status !== 'libre' &&
      targetTable.id !== order.tableId &&
      targetTable.currentOrderId !== order.id
    ) {
      return {
        valid: false,
        error:
          'Esa mesa ya tiene un pedido activo. Elige una mesa libre o selecciona "Solo estos productos (misma cuenta)".',
        scope: input.scope,
        destination: baseDestination,
        isDifferentFromOrder: false,
      };
    }

    const tableLabel = `Mesa ${targetTable.number} (${targetTable.zone})`;
    const isSameTable = order.type === 'mesa' && order.tableId === targetTable.id;

    return {
      valid: true,
      scope: input.scope,
      destination: {
        type: 'mesa',
        label: tableLabel,
        tableId: targetTable.id,
        tableName: tableLabel,
      },
      isDifferentFromOrder: !isSameTable,
      selectedTable: targetTable,
    };
  }

  if (targetType === 'domicilio') {
    if (!cleanAddress) {
      return {
        valid: false,
        error: 'Ingresa la dirección de entrega para el domicilio.',
        scope: input.scope,
        destination: baseDestination,
        isDifferentFromOrder: false,
      };
    }

    const label = `Domicilio · ${cleanAddress}`;
    const isSameDomicilio =
      order.type === 'domicilio' &&
      (order.customerAddress || '').trim().toLowerCase() === cleanAddress.toLowerCase();

    return {
      valid: true,
      scope: input.scope,
      destination: {
        type: 'domicilio',
        label,
        tableId: null,
        tableName: 'Domicilio',
        customerName: cleanName || undefined,
        customerPhone: cleanPhone || undefined,
        customerAddress: cleanAddress,
      },
      isDifferentFromOrder: !isSameDomicilio,
      selectedTable: null,
    };
  }

  if (targetType === 'mostrador') {
    const label = cleanName ? `Mostrador · ${cleanName}` : 'Mostrador';
    const isSameMostrador =
      order.type === 'mostrador' &&
      (!cleanName || cleanName.toLowerCase() === (order.customerName || '').trim().toLowerCase());

    return {
      valid: true,
      scope: input.scope,
      destination: {
        type: 'mostrador',
        label,
        tableId: null,
        tableName: 'Mostrador',
        customerName: cleanName || undefined,
      },
      isDifferentFromOrder: !isSameMostrador,
      selectedTable: null,
    };
  }

  // para_llevar
  const label = cleanName ? `Para Llevar · ${cleanName}` : 'Para Llevar';
  const isSameTakeout =
    order.type === 'para_llevar' &&
    (!cleanName || cleanName.toLowerCase() === (order.customerName || '').trim().toLowerCase());

  return {
    valid: true,
    scope: input.scope,
    destination: {
      type: 'para_llevar',
      label,
      tableId: null,
      tableName: 'Para Llevar',
      customerName: cleanName || undefined,
      customerPhone: cleanPhone || undefined,
    },
    isDifferentFromOrder: !isSameTakeout,
    selectedTable: null,
  };
}
