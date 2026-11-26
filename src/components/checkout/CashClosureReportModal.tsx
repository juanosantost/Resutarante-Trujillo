import React from 'react';
import { CashClosure, CashFlowEntryKind } from '../../types';
import { formatCOP, formatColombiaDateTime } from '../../utils/calculations';
import { getDifferenceStatus } from '../../utils/cashReconciliationUtils';
import {
  X,
  FileText,
  Printer,
  Banknote,
  ArrowUpRight,
  ArrowDownRight,
  Coins,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Clock,
  User,
  MinusCircle,
} from 'lucide-react';

interface CashClosureReportModalProps {
  closure: CashClosure;
  onClose: () => void;
}

const KIND_LABELS: Record<CashFlowEntryKind, string> = {
  venta: 'Venta',
  abono_separado: 'Abono Separado',
  abono_cartera: 'Abono Cartera',
  otro_ingreso: 'Otro Ingreso',
  reintegro_proveedor: 'Reintegro',
  caja_menor_ingreso: 'Caja Menor (+)',
  gasto: 'Gasto',
  pago_proveedor: 'Pago Proveedor',
  anticipo_proveedor: 'Anticipo Proveedor',
  caja_menor_egreso: 'Caja Menor (-)',
};

export const CashClosureReportModal: React.FC<CashClosureReportModalProps> = ({
  closure,
  onClose,
}) => {
  const cashRow = closure.methodBalances.find((m) => m.isCash);
  const cashStatus = getDifferenceStatus(
    cashRow ? cashRow.registeredAmount : closure.cashRegistered,
    cashRow ? cashRow.difference : closure.cashDifference
  );

  const renderStatusBadge = (registeredAmount: number | null, difference: number | null) => {
    const st = getDifferenceStatus(registeredAmount, difference);
    if (st === 'sin_registrar') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#18171f] text-[#a8a29e] border border-[#383124]">
          <MinusCircle className="w-3 h-3" />
          <span>Sin registrar</span>
        </span>
      );
    }
    if (st === 'cuadrado') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-950/70 text-emerald-300 border border-emerald-600/60">
          <CheckCircle2 className="w-3 h-3" />
          <span>Cuadrado ($0)</span>
        </span>
      );
    }
    if (st === 'sobrante') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-sky-950/70 text-sky-300 border border-sky-600/60">
          <TrendingUp className="w-3 h-3" />
          <span>Sobrante +{formatCOP(difference || 0)}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-red-950/70 text-red-300 border border-red-600/60">
        <AlertTriangle className="w-3 h-3" />
        <span>Faltante {formatCOP(difference || 0)}</span>
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div className="bg-[#121117] border border-[#3f3521] rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl text-[#faf5ee] overflow-hidden">
        {/* Cabecera */}
        <div className="px-5 py-4 border-b border-[#2d281e] bg-[#1a1722] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#2b2416] border border-[#d4af37]/50 flex items-center justify-center text-[#d4af37]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-black text-[#fef3c7]">
                  Informe de Cierre de Caja · {closure.consecutivo}
                </h3>
                {renderStatusBadge(closure.cashRegistered, closure.cashDifference)}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#a8a29e] mt-0.5">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#d4af37]" />
                  <span>
                    Período:{' '}
                    {closure.periodStart
                      ? formatColombiaDateTime(closure.periodStart)
                      : 'Inicio de registros'}{' '}
                    → {formatColombiaDateTime(closure.closedAt)}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <User className="w-3 h-3 text-[#d4af37]" />
                  <span>Responsable: {closure.userName}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-xl bg-[#2b2416] hover:bg-[#3d321d] border border-[#d4af37]/50 text-[#fef3c7] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>Imprimir</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-[#18171f] hover:bg-[#2b2416] border border-[#2d281e] text-[#a8a29e] hover:text-[#fef3c7] cursor-pointer"
              aria-label="Cerrar informe de cierre"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* 1. BLOQUE PRINCIPAL: BALANCE DE EFECTIVO (LO MÁS IMPORTANTE) */}
          <div className="p-5 rounded-2xl bg-[#18171f] border border-[#d4af37]/50 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#2d281e]">
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-400" />
                <div>
                  <h4 className="text-sm font-black text-[#fef3c7]">
                    Cuadre Principal de Efectivo
                  </h4>
                  <p className="text-[11px] text-[#a8a29e]">
                    Balance = Base + Ingresos en Efectivo − Desembolsos en Efectivo
                  </p>
                </div>
              </div>
              {renderStatusBadge(closure.cashRegistered, closure.cashDifference)}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3 rounded-xl bg-[#14131a] border border-[#2d281e]">
                <span className="text-[10px] uppercase font-bold text-[#a8a29e] block">Base</span>
                <span className="text-sm font-black text-[#fef3c7] font-mono mt-1 block">
                  {formatCOP(closure.baseTotal)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#14131a] border border-[#2d281e]">
                <span className="text-[10px] uppercase font-bold text-emerald-400 block">
                  + Ingresos Efectivo
                </span>
                <span className="text-sm font-black text-emerald-400 font-mono mt-1 block">
                  +{formatCOP(cashRow?.incomesTotal || 0)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#14131a] border border-[#2d281e]">
                <span className="text-[10px] uppercase font-bold text-red-400 block">
                  − Desembolsos Efectivo
                </span>
                <span className="text-sm font-black text-red-400 font-mono mt-1 block">
                  -{formatCOP(cashRow?.disbursementsTotal || 0)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#2b2416] border border-[#d4af37]/50">
                <span className="text-[10px] uppercase font-black text-[#d4af37] block">
                  Efectivo Esperado
                </span>
                <span className="text-sm font-black text-[#fef3c7] font-mono mt-1 block">
                  {formatCOP(closure.cashExpected)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#14131a] border border-[#383124]">
                <span className="text-[10px] uppercase font-bold text-[#fef3c7] block">
                  Efectivo Registrado
                </span>
                <span className="text-sm font-black text-[#d4af37] font-mono mt-1 block">
                  {formatCOP(closure.cashRegistered)}
                </span>
              </div>
              <div
                className={`p-3 rounded-xl border ${
                  cashStatus === 'cuadrado'
                    ? 'bg-emerald-950/60 border-emerald-600/60'
                    : cashStatus === 'sobrante'
                    ? 'bg-sky-950/60 border-sky-600/60'
                    : 'bg-red-950/60 border-red-600/60'
                }`}
              >
                <span className="text-[10px] uppercase font-black text-[#fef3c7] block">
                  {cashStatus === 'cuadrado'
                    ? 'Diferencia'
                    : cashStatus === 'sobrante'
                    ? 'Sobrante'
                    : 'Faltante'}
                </span>
                <span className="text-sm font-black text-[#fef3c7] font-mono mt-1 block">
                  {closure.cashDifference > 0 ? '+' : ''}
                  {formatCOP(closure.cashDifference)}
                </span>
              </div>
            </div>

            {closure.notes && (
              <div className="p-3 rounded-xl bg-[#14131a] border border-[#2d281e] text-xs text-[#a8a29e]">
                <strong className="text-[#fef3c7]">Observaciones:</strong> {closure.notes}
              </div>
            )}
          </div>

          {/* 2. BALANCE GENERAL POR TODOS LOS MEDIOS DE PAGO */}
          <div className="rounded-2xl bg-[#14131a] border border-[#2d281e] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2d281e] bg-[#1a1922] flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#d4af37]">
                Balance por Medio de Pago
              </h4>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-emerald-400 font-bold">
                  Total Ingresos: {formatCOP(closure.totalIncomes)}
                </span>
                <span className="text-red-400 font-bold">
                  Total Desembolsos: {formatCOP(closure.totalDisbursements)}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#18171f] text-[10px] uppercase text-[#a8a29e] border-b border-[#2d281e]">
                  <tr>
                    <th className="px-4 py-2.5">Medio de Pago</th>
                    <th className="px-3 py-2.5 text-right">Base</th>
                    <th className="px-3 py-2.5 text-right">Ingresos</th>
                    <th className="px-3 py-2.5 text-right">Desembolsos</th>
                    <th className="px-3 py-2.5 text-right">Balance Esperado</th>
                    <th className="px-3 py-2.5 text-right">Valor Registrado</th>
                    <th className="px-4 py-2.5 text-right">Resultado / Diferencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d281e]">
                  {closure.methodBalances.map((mb) => (
                    <tr
                      key={mb.methodId}
                      className={mb.isCash ? 'bg-[#2b2416]/40 font-semibold' : ''}
                    >
                      <td className="px-4 py-2.5 font-bold text-[#fef3c7]">
                        <div className="flex items-center gap-2">
                          <span>{mb.methodName}</span>
                          {mb.isCash && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-950/70 text-emerald-300 border border-emerald-600/50">
                              Principal
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[#a8a29e]">
                        {mb.baseAmount > 0 ? formatCOP(mb.baseAmount) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-emerald-400">
                        {formatCOP(mb.incomesTotal)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-red-400">
                        {formatCOP(mb.disbursementsTotal)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-[#fef3c7]">
                        {formatCOP(mb.expectedAmount)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-black">
                        {mb.registeredAmount === null ? (
                          <span className="text-[#a8a29e] italic font-normal">Sin registrar</span>
                        ) : (
                          <span className="text-[#d4af37]">{formatCOP(mb.registeredAmount)}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {renderStatusBadge(mb.registeredAmount, mb.difference)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2.5 DETALLE DE BASES DEL PERÍODO */}
          {closure.baseEntries && closure.baseEntries.length > 0 && (
            <div className="rounded-2xl bg-[#14131a] border border-[#2d281e] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#2d281e] bg-[#1a1922] flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-[#d4af37] flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5" />
                  <span>Bases Registradas en este Período ({closure.baseEntries.length})</span>
                </h4>
                <span className="text-xs font-black font-mono text-[#fef3c7]">
                  Total: {formatCOP(closure.baseTotal)}
                </span>
              </div>
              <div className="divide-y divide-[#2d281e]">
                {closure.baseEntries.map((b) => (
                  <div
                    key={b.id}
                    className="px-4 py-2.5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-[#fef3c7]">{b.reason}</span>
                      <span className="block text-[10px] text-[#a8a29e]">
                        {formatColombiaDateTime(b.createdAt)} · {b.userName}
                      </span>
                    </div>
                    <span className="font-black font-mono text-[#d4af37]">
                      {formatCOP(b.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. TABLA DE MOVIMIENTOS DE INGRESOS DEL CIERRE */}
          <div className="rounded-2xl bg-[#14131a] border border-[#2d281e] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2d281e] bg-[#1a1922] flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <ArrowUpRight className="w-4 h-4" />
                <span>Movimientos de Ingresos ({closure.incomes.length})</span>
              </h4>
              <span className="text-xs font-black font-mono text-emerald-400">
                Total: {formatCOP(closure.totalIncomes)}
              </span>
            </div>

            {closure.incomes.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#a8a29e]">
                No se registraron ingresos en este período.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#18171f] text-[10px] uppercase text-[#a8a29e] border-b border-[#2d281e] sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Fecha / Hora</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Ref.</th>
                      <th className="px-3 py-2">Concepto</th>
                      <th className="px-3 py-2">Tercero</th>
                      <th className="px-3 py-2">Medio de Pago</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2d281e]">
                    {closure.incomes.map((inc) => (
                      <tr key={inc.id}>
                        <td className="px-3 py-2 text-[11px] text-[#a8a29e] whitespace-nowrap">
                          {formatColombiaDateTime(inc.date)}
                        </td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-700/50 text-[10px] font-bold whitespace-nowrap">
                            {KIND_LABELS[inc.kind] || inc.kind}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-[#d4af37]">
                          {inc.consecutivo}
                        </td>
                        <td className="px-3 py-2 text-[#fef3c7] font-medium">{inc.concept}</td>
                        <td className="px-3 py-2 text-[#a8a29e]">{inc.thirdParty}</td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 rounded bg-[#2b2416] text-[#fef3c7] border border-[#d4af37]/30 text-[10px] font-bold whitespace-nowrap">
                            {inc.paymentMethodName}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-black text-emerald-400 whitespace-nowrap">
                          +{formatCOP(inc.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 4. TABLA DE MOVIMIENTOS DE DESEMBOLSOS DEL CIERRE */}
          <div className="rounded-2xl bg-[#14131a] border border-[#2d281e] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2d281e] bg-[#1a1922] flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                <ArrowDownRight className="w-4 h-4" />
                <span>Movimientos de Desembolsos ({closure.disbursements.length})</span>
              </h4>
              <span className="text-xs font-black font-mono text-red-400">
                Total: {formatCOP(closure.totalDisbursements)}
              </span>
            </div>

            {closure.disbursements.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#a8a29e]">
                No se registraron desembolsos en este período.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#18171f] text-[10px] uppercase text-[#a8a29e] border-b border-[#2d281e] sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Fecha / Hora</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Ref.</th>
                      <th className="px-3 py-2">Concepto</th>
                      <th className="px-3 py-2">Tercero</th>
                      <th className="px-3 py-2">Medio de Pago</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2d281e]">
                    {closure.disbursements.map((disb) => (
                      <tr key={disb.id}>
                        <td className="px-3 py-2 text-[11px] text-[#a8a29e] whitespace-nowrap">
                          {formatColombiaDateTime(disb.date)}
                        </td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 rounded bg-red-950/60 text-red-300 border border-red-700/50 text-[10px] font-bold whitespace-nowrap">
                            {KIND_LABELS[disb.kind] || disb.kind}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-[#d4af37]">
                          {disb.consecutivo}
                        </td>
                        <td className="px-3 py-2 text-[#fef3c7] font-medium">{disb.concept}</td>
                        <td className="px-3 py-2 text-[#a8a29e]">{disb.thirdParty}</td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 rounded bg-[#2b2416] text-[#fef3c7] border border-[#d4af37]/30 text-[10px] font-bold whitespace-nowrap">
                            {disb.paymentMethodName}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-black text-red-400 whitespace-nowrap">
                          -{formatCOP(disb.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
