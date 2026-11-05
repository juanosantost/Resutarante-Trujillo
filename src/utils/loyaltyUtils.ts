/**
 * Utilidades de cálculo y validación para Clientes y Fidelización (Módulo 12)
 */

import { LoyaltyConfig } from '../types';

export const DEFAULT_LOYALTY_CONFIG: LoyaltyConfig = {
  isEnabled: true,
  pointsPerPeso: 0.001, // 1 punto por cada $1.000 gastados (1000 * 0.001 = 1 punto)
  pesosPerRedemptionPoint: 10, // 1 punto = $10 COP de descuento
  minPointsToRedeem: 100, // Mínimo 100 puntos para redimir
};

/**
 * Calcula los puntos de fidelización ganados por un valor de compra.
 */
export function calculateEarnedPoints(totalSpent: number, config: LoyaltyConfig = DEFAULT_LOYALTY_CONFIG): number {
  if (!config.isEnabled || totalSpent <= 0) return 0;
  const points = Math.floor(totalSpent * config.pointsPerPeso);
  return Math.max(0, points);
}

/**
 * Calcula el valor en COP del descuento al redimir puntos.
 */
export function calculateRedemptionValue(points: number, config: LoyaltyConfig = DEFAULT_LOYALTY_CONFIG): number {
  if (!config.isEnabled || points < config.minPointsToRedeem) return 0;
  return points * config.pesosPerRedemptionPoint;
}

/**
 * Genera mensajes predefinidos para WhatsApp con clientes.
 */
export function generateWhatsAppMessage(templateType: 'bienvenida' | 'promocion' | 'estado_pedido' | 'fidelizacion', customerName: string, extraData?: { points?: number; orderNumber?: number }): string {
  switch (templateType) {
    case 'bienvenida':
      return `¡Hola ${customerName}! 👋 Gracias por registrarte en Colmena Restaurante. Es un placer atenderte.`;
    case 'promocion':
      return `¡Hola ${customerName}! 🍔 Tenemos promociones especiales y deliciosas hoy en Colmena Restaurante. ¿Te provoca algo de nuestro menú?`;
    case 'estado_pedido':
      return `¡Hola ${customerName}! 🛵 Tu pedido #${extraData?.orderNumber || ''} de Colmena Restaurante va en camino. ¡Buen provecho!`;
    case 'fidelizacion':
      return `¡Hola ${customerName}! 🌟 Tienes ${extraData?.points || 0} puntos acumulados en Colmena Restaurante listos para redimir. ¡Disfrútalos en tu próxima visita!`;
    default:
      return `¡Hola ${customerName}! 🐝 Te saludamos desde Colmena Restaurante.`;
  }
}
