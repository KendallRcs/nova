const areas = ['Inventario', 'Ventas', 'Clientes', 'Caja'];

export default function HomePage() {
  return (
    <main className="shell">
      <section className="welcome" aria-labelledby="nova-title">
        <div className="brand-row">
          <span className="brand-mark" aria-hidden="true">
            N
          </span>
          <p className="eyebrow">Sistema interno de la tienda</p>
        </div>

        <div className="heading-group">
          <h1 id="nova-title">Nova</h1>
          <p>Ventas, inventario y cuentas en un solo lugar.</p>
        </div>

        <div className="status-line" role="status">
          <span className="status-dot" aria-hidden="true" />
          <span>Base del sistema preparada</span>
        </div>
      </section>

      <aside className="ledger" aria-label="Áreas que organizará Nova">
        <p className="ledger-label">Áreas del negocio</p>
        <ol>
          {areas.map((area, index) => (
            <li key={area}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              {area}
            </li>
          ))}
        </ol>
        <p className="ledger-note">La primera capacidad será administrar categorías.</p>
      </aside>
    </main>
  );
}
