import type { ReactNode } from 'react';
import { formatMoney, humanize } from '../format';
import type { PaymentsState, ReservationsState, ServiceError, Services, ShipmentsState, StockState } from '../types';

export function isServiceError(v: unknown): v is ServiceError {
  return !!v && typeof v === 'object' && 'error' in v && 'message' in v;
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card" aria-label={`${title} service state`}>
      <h3 className="card__title">
        {title} <span className="tag tag--sim">simulated · live</span>
      </h3>
      {children}
    </section>
  );
}

function ServiceFailure({ err }: { err: ServiceError }) {
  return (
    <p className="inline-error" role="alert">
      ✗ Could not read service ({err.error}): {err.message}
    </p>
  );
}

function PaymentCard({ data }: { data: PaymentsState | ServiceError }) {
  if (isServiceError(data)) return <ServiceFailure err={data} />;
  const { payments, events, refunds } = data;
  return (
    <>
      <h4 className="subhead">Payments ({payments.length})</h4>
      {payments.length === 0 ? (
        <p className="muted small">No payment records.</p>
      ) : (
        <ul className="plain-list">
          {payments.map((p) => (
            <li key={p.id}>
              <code>{p.id}</code> · <strong>{humanize(p.status)}</strong> · {formatMoney(p.amount_cents, p.currency)}
              {p.memo && <span className="untrusted block">memo: {p.memo}</span>}
            </li>
          ))}
        </ul>
      )}
      <h4 className="subhead">Events ({events.length})</h4>
      {events.length === 0 ? (
        <p className="muted small">No events.</p>
      ) : (
        <ul className="plain-list">
          {events.map((e, i) => (
            <li key={i}>
              {humanize(e.type)} · {formatMoney(e.amount_cents)} · <span className="muted">{e.source}</span>
              {e.memo && <span className="untrusted block">memo: {e.memo}</span>}
            </li>
          ))}
        </ul>
      )}
      <h4 className="subhead">Refunds ({refunds.length})</h4>
      {refunds.length === 0 ? (
        <p className="muted small">No refunds issued.</p>
      ) : (
        <ul className="plain-list">
          {refunds.map((r) => (
            <li key={r.id}>
              <code>{r.id}</code> · {formatMoney(r.amount_cents)}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function InventoryCard({ reservations, stock }: { reservations: ReservationsState | ServiceError; stock: StockState | ServiceError }) {
  return (
    <>
      <h4 className="subhead">Stock</h4>
      {isServiceError(stock) ? (
        <ServiceFailure err={stock} />
      ) : (
        <p>
          <code>{stock.sku}</code>: <strong>{stock.available}</strong> available, {stock.reserved} reserved
        </p>
      )}
      <h4 className="subhead">Reservations{!isServiceError(reservations) && ` (${reservations.reservations.length})`}</h4>
      {isServiceError(reservations) ? (
        <ServiceFailure err={reservations} />
      ) : reservations.reservations.length === 0 ? (
        <p className="muted small">No reservations.</p>
      ) : (
        <ul className="plain-list">
          {reservations.reservations.map((r) => (
            <li key={r.id}>
              <code>{r.id}</code> · qty {r.quantity} · <strong>{humanize(r.status)}</strong>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function ShipmentCard({ data }: { data: ShipmentsState | ServiceError }) {
  if (isServiceError(data)) return <ServiceFailure err={data} />;
  if (data.shipments.length === 0) return <p className="muted small">No shipments.</p>;
  return (
    <ul className="plain-list">
      {data.shipments.map((s) => (
        <li key={s.id}>
          <code>{s.id}</code> · <strong>{humanize(s.status)}</strong>
          {(s.carrier || s.tracking) && (
            <span className="block muted small">
              {s.carrier} {s.tracking && <code>{s.tracking}</code>}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ServiceCards({ services }: { services: Services }) {
  return (
    <section aria-labelledby="services-title">
      <h2 id="services-title" className="section-title">
        Simulated service state <span className="muted small">(live read, not an agent action)</span>
      </h2>
      <div className="grid grid--3">
        <Card title="Payment">
          <PaymentCard data={services.payment} />
        </Card>
        <Card title="Inventory">
          <InventoryCard reservations={services.inventory} stock={services.stock} />
        </Card>
        <Card title="Shipment">
          <ShipmentCard data={services.shipment} />
        </Card>
      </div>
    </section>
  );
}
