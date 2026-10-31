import { formatDateTime, formatMoney } from '../format';
import type { Order } from '../types';
import { StatusChip } from './StatusChip';

function Ref({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="kv">
      <dt>{label}</dt>
      <dd>{value ? <code>{value}</code> : <span className="muted">—</span>}</dd>
    </div>
  );
}

export function OrderSummary({ order }: { order: Order }) {
  return (
    <section className="panel" aria-labelledby="order-title">
      <div className="panel__head">
        <h2 id="order-title" className="panel__title">
          Order {order.id}
        </h2>
        <StatusChip kind="order" status={order.status} />
      </div>
      <dl className="kv-grid">
        <div className="kv">
          <dt>Total</dt>
          <dd className="strong">{formatMoney(order.total_cents, order.currency)}</dd>
        </div>
        <div className="kv">
          <dt>Quantity</dt>
          <dd>{order.quantity}</dd>
        </div>
        <div className="kv">
          <dt>SKU</dt>
          <dd>
            <code>{order.sku}</code>
          </dd>
        </div>
        <div className="kv">
          <dt>Customer</dt>
          <dd>{order.customer_email}</dd>
        </div>
        <div className="kv">
          <dt>Created</dt>
          <dd>{formatDateTime(order.created_at)}</dd>
        </div>
        <div className="kv">
          <dt>Updated</dt>
          <dd>{formatDateTime(order.updated_at)}</dd>
        </div>
        {order.scenario_label && (
          <div className="kv">
            <dt>Injected scenario</dt>
            <dd>
              <code>{order.scenario_label}</code> <span className="muted small">(hidden from the agent)</span>
            </dd>
          </div>
        )}
      </dl>
      <h3 className="subhead">References</h3>
      <dl className="kv-grid">
        <Ref label="Payment ref" value={order.payment_ref} />
        <Ref label="Reservation" value={order.reservation_id} />
        <Ref label="Shipment" value={order.shipment_id} />
        <Ref label="Refund" value={order.refund_id} />
      </dl>
      <h3 className="subhead">Untrusted text</h3>
      <p className="muted small">Shown as plain text. The agent treats these as data, never as instructions.</p>
      <dl className="kv-grid kv-grid--wide">
        <div className="kv">
          <dt>Workflow error</dt>
          <dd className="untrusted" data-testid="workflow-error">
            {order.workflow_error ?? <span className="muted">—</span>}
          </dd>
        </div>
        <div className="kv">
          <dt>Customer note</dt>
          <dd className="untrusted" data-testid="customer-note">
            {order.customer_note ?? <span className="muted">—</span>}
          </dd>
        </div>
      </dl>
    </section>
  );
}
