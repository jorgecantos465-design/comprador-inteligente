import { useEffect, useMemo, useRef, useState } from "react";
import { calculateStrategy } from "../domain/calculate";
import { downloadStrategyCsv } from "../domain/exportCsv";
import { clearLocalSession, loadLocalSession, saveLocalSession } from "../domain/localSession";
import { parseOrderText } from "../domain/parseOrderText";
import type { Alias, PriceList, PriceRow, PurchaseItem, Supplier, Unit } from "../domain/types";
import { parsePriceFile } from "../parsers/parseFile";

const units: Unit[] = ["kg", "g", "l", "ml", "unit", "pack"];
const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export default function BuyerApp() {
  const [initialSession] = useState(() => typeof window === "undefined" ? {} : loadLocalSession(window.localStorage));
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSession.session?.suppliers ?? []);
  const [lists, setLists] = useState<PriceList[]>(initialSession.session?.lists ?? []);
  const [items, setItems] = useState<PurchaseItem[]>(initialSession.session?.items ?? []);
  const [aliases, setAliases] = useState<Alias[]>(initialSession.session?.aliases ?? []);
  const [supplierDraft, setSupplierDraft] = useState({ name: "", distance: "", notes: "" });
  const [itemDraft, setItemDraft] = useState({ buyer: "Jorge", product: "", quantity: 1, unit: "kg" as Unit });
  const [orderText, setOrderText] = useState("");
  const [importedItems, setImportedItems] = useState<PurchaseItem[]>([]);
  const [expandedSupplierIds, setExpandedSupplierIds] = useState<string[]>([]);
  const [busySupplierId, setBusySupplierId] = useState("");
  const [message, setMessage] = useState("");
  const [storageNotice, setStorageNotice] = useState(initialSession.session ? "Se restauró la última sesión guardada en este navegador." : "");
  const [storageWarning, setStorageWarning] = useState(initialSession.error ?? "");
  const skipNextAutoSaveRef = useRef(false);
  const supplierNameRef = useRef<HTMLInputElement>(null);

  const strategy = useMemo(
    () => calculateStrategy(suppliers, lists, items, aliases),
    [suppliers, lists, items, aliases],
  );
  const unresolved = strategy.comparisons.filter((comparison) => comparison.unresolved);
  const detectedProducts = lists.reduce((total, list) => total + list.rows.filter((row) => row.product.trim()).length, 0);

  useEffect(() => {
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false;
      return;
    }
    const error = saveLocalSession(window.localStorage, { suppliers, lists, aliases, items });
    setStorageWarning(error ?? "");
  }, [suppliers, lists, aliases, items]);

  function addSupplier(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supplierDraft.name.trim()) return;
    const id = crypto.randomUUID();
    setSuppliers((current) => [...current, { id, ...supplierDraft, name: supplierDraft.name.trim() }]);
    setExpandedSupplierIds((current) => [...current, id]);
    setSupplierDraft({ name: "", distance: "", notes: "" });
  }

  async function addFiles(supplierId: string, files: FileList | null) {
    if (!files?.length) return;
    setBusySupplierId(supplierId);
    setMessage("");
    for (const file of Array.from(files)) {
      try {
        const parsed = await parsePriceFile(file);
        setLists((current) => [...current, {
          id: crypto.randomUUID(),
          supplierId,
          fileName: file.name,
          sourceType: parsed.sourceType,
          rows: parsed.rows,
          warnings: parsed.warnings,
        }]);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : `No se pudo procesar ${file.name}.`);
      }
    }
    setBusySupplierId("");
  }

  function addItem(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!itemDraft.buyer.trim() || !itemDraft.product.trim() || itemDraft.quantity <= 0) return;
    setItems((current) => [...current, { id: crypto.randomUUID(), ...itemDraft, buyer: itemDraft.buyer.trim(), product: itemDraft.product.trim() }]);
    setItemDraft((current) => ({ ...current, product: "", quantity: 1 }));
  }

  function previewOrderText() {
    setImportedItems(parseOrderText(orderText));
  }

  function updateImportedItem(id: string, patch: Partial<PurchaseItem>) {
    setImportedItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function addImportedItems() {
    setItems((current) => [...current, ...importedItems.filter((item) => item.product.trim() && item.quantity > 0)]);
    setImportedItems([]);
    setOrderText("");
  }

  function focusSupplierForm() {
    document.querySelector("#proveedores")?.scrollIntoView({ behavior: "smooth" });
    supplierNameRef.current?.focus();
  }

  function toggleSupplier(supplierId: string) {
    setExpandedSupplierIds((current) => current.includes(supplierId)
      ? current.filter((id) => id !== supplierId)
      : [...current, supplierId]);
  }

  function updateRow(listId: string, rowId: string, patch: Partial<PriceRow>) {
    setLists((current) => current.map((list) => list.id === listId
      ? { ...list, rows: list.rows.map((row) => {
        if (row.id !== rowId) return row;
        const updated = { ...row, ...patch };
        return { ...updated, warnings: [
          ...(!updated.product.trim() ? ["Falta producto."] : []),
          ...(updated.price <= 0 ? ["Precio inválido."] : []),
        ] };
      }) }
      : list));
  }

  function addManualList(supplierId: string) {
    setLists((current) => [...current, {
      id: crypto.randomUUID(),
      supplierId,
      fileName: `lista-manual-${current.filter((list) => list.supplierId === supplierId && list.sourceType === "manual").length + 1}`,
      sourceType: "manual",
      rows: [emptyRow(1)],
      warnings: ["Lista manual: completá o corregí los datos antes de comparar."],
    }]);
  }

  function addRow(listId: string) {
    setLists((current) => current.map((list) => list.id === listId
      ? { ...list, rows: [...list.rows, emptyRow(list.rows.length + 1)] }
      : list));
  }

  function removeRow(listId: string, rowId: string) {
    setLists((current) => current.map((list) => list.id === listId
      ? { ...list, rows: list.rows.filter((row) => row.id !== rowId) }
      : list));
  }

  function saveSessionNow() {
    const error = saveLocalSession(window.localStorage, { suppliers, lists, aliases, items });
    setStorageWarning(error ?? "");
    if (!error) setStorageNotice("Sesión guardada en este navegador.");
  }

  function deleteSavedSession() {
    const error = clearLocalSession(window.localStorage);
    setStorageWarning(error ?? "");
    if (!error) setStorageNotice("Se borró la sesión guardada. Los datos actuales siguen visibles.");
  }

  function deleteEverything() {
    skipNextAutoSaveRef.current = true;
    const error = clearLocalSession(window.localStorage);
    setStorageWarning(error ?? "");
    setStorageNotice(error ? "" : "Se borraron los datos actuales y la sesión guardada.");
    setSuppliers([]);
    setLists([]);
    setItems([]);
    setAliases([]);
    setImportedItems([]);
    setOrderText("");
    setExpandedSupplierIds([]);
  }

  const supplierName = (id?: string) => suppliers.find((supplier) => supplier.id === id)?.name ?? "Sin proveedor";
  const percent = (value?: number) => value === undefined ? "—" : `${value.toFixed(1)}%`;

  return (
    <main>
      <header className="hero">
        <p className="eyebrow">MVP local · sin login · sin base de datos</p>
        <h1>Comprador Inteligente</h1>
        <p>Consolidá listas de proveedores y encontrá dónde conviene comprar cada producto.</p>
      </header>

      <nav className="quick-nav" aria-label="Navegación rápida">
        <a href="#proveedores">Proveedores</a>
        <a href="#pedido">Pedido</a>
        <a href="#reporte">Reporte</a>
      </nav>

      {message && <div className="alert error">{message}</div>}
      {storageNotice && <div className="alert success">{storageNotice}</div>}
      {storageWarning && <div className="alert warning">{storageWarning}</div>}

      <aside className="local-session">
        <div>
          <strong>Guardado local opcional</strong>
          <p>Los datos se guardan solo en este navegador. No se suben a un servidor.</p>
        </div>
        <div className="session-actions">
          <button onClick={saveSessionNow}>Guardar sesión ahora</button>
          <button className="secondary" onClick={() => setItems([])}>Limpiar pedido</button>
          <button className="secondary" onClick={deleteSavedSession}>Borrar sesión guardada</button>
          <button className="danger secondary" onClick={deleteEverything}>Borrar todo</button>
        </div>
      </aside>

      <section id="proveedores">
        <div className="section-title">
          <div><span className="step">1</span><h2>Proveedores y listas</h2></div>
          <p>Cada proveedor puede tener varios archivos. Todos se comparan como una oferta consolidada.</p>
        </div>
        <div className="metrics supplier-metrics">
          <Metric label="Proveedores cargados" value={String(suppliers.length)} />
          <Metric label="Listas cargadas" value={String(lists.length)} />
          <Metric label="Productos detectados" value={String(detectedProducts)} />
        </div>
        <form className="form-grid supplier-form" onSubmit={addSupplier}>
          <label>Nombre<input ref={supplierNameRef} value={supplierDraft.name} onChange={(event) => setSupplierDraft({ ...supplierDraft, name: event.target.value })} placeholder="Proveedor A" required /></label>
          <label>Distancia o cercanía<input value={supplierDraft.distance} onChange={(event) => setSupplierDraft({ ...supplierDraft, distance: event.target.value })} placeholder="Opcional" /></label>
          <label>Observaciones<input value={supplierDraft.notes} onChange={(event) => setSupplierDraft({ ...supplierDraft, notes: event.target.value })} placeholder="Opcional" /></label>
          <button type="submit">Crear proveedor</button>
        </form>
        <button className="add-supplier" onClick={focusSupplierForm}>Agregar otro proveedor</button>

        {!suppliers.length && <Empty text="Creá el primer proveedor para adjuntar sus listas." />}
        <div className="supplier-grid">
          {suppliers.map((supplier) => {
            const supplierLists = lists.filter((list) => list.supplierId === supplier.id);
            const expanded = expandedSupplierIds.includes(supplier.id);
            return (
              <article className="supplier-card" key={supplier.id}>
                <div className="card-head">
                  <button className="supplier-toggle" aria-expanded={expanded} onClick={() => toggleSupplier(supplier.id)}>
                    <span>{expanded ? "−" : "+"}</span>
                    <span><strong>{supplier.name}</strong><small>{supplierLists.length} listas · {supplierLists.reduce((total, list) => total + list.rows.filter((row) => row.product.trim()).length, 0)} productos</small></span>
                  </button>
                  <div className="supplier-actions">
                    <small>{supplier.distance || "Sin distancia"}{supplier.notes ? ` · ${supplier.notes}` : ""}</small>
                    <button className="danger ghost" onClick={() => {
                      setSuppliers((current) => current.filter((item) => item.id !== supplier.id));
                      setLists((current) => current.filter((list) => list.supplierId !== supplier.id));
                    }}>Eliminar</button>
                  </div>
                </div>
                {expanded && <div className="supplier-content">
                  <label className="upload">
                    <span>{busySupplierId === supplier.id ? "Procesando…" : "Adjuntar listas XLSX, CSV o PDF"}</span>
                    <input type="file" multiple accept=".xlsx,.xls,.csv,.pdf" onChange={(event) => void addFiles(supplier.id, event.target.files)} />
                  </label>
                  <button className="secondary" onClick={() => addManualList(supplier.id)}>Crear lista manual</button>
                  {supplierLists.map((list) => (
                    <div className="file-block" key={list.id}>
                      <div className="file-title">
                        <strong>{list.fileName}</strong>
                        <span>{list.rows.length} filas · {list.sourceType.toUpperCase()}</span>
                        <button className="danger ghost" onClick={() => setLists((current) => current.filter((item) => item.id !== list.id))}>Quitar</button>
                      </div>
                      {list.warnings.map((warning) => <div className="alert warning" key={warning}>{warning}</div>)}
                      <EditablePriceRows list={list} updateRow={updateRow} addRow={addRow} removeRow={removeRow} />
                    </div>
                  ))}
                </div>}
              </article>
            );
          })}
        </div>
      </section>

      <section id="pedido">
        <div className="section-title">
          <div><span className="step">2</span><h2>Pedido</h2></div>
          <p>Cargá varios compradores en un mismo pedido.</p>
        </div>
        <form className="form-grid order-form" onSubmit={addItem}>
          <label>Comprador<input list="buyers" value={itemDraft.buyer} onChange={(event) => setItemDraft({ ...itemDraft, buyer: event.target.value })} required /></label>
          <datalist id="buyers"><option value="Jorge" /><option value="Mamá" /><option value="Cliente" /><option value="Otro" /></datalist>
          <label>Producto<input value={itemDraft.product} onChange={(event) => setItemDraft({ ...itemDraft, product: event.target.value })} placeholder="Almendras naturales" required /></label>
          <label>Cantidad<input type="number" min="0.001" step="any" value={itemDraft.quantity} onChange={(event) => setItemDraft({ ...itemDraft, quantity: Number(event.target.value) })} required /></label>
          <label>Unidad<select value={itemDraft.unit} onChange={(event) => setItemDraft({ ...itemDraft, unit: event.target.value as Unit })}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
          <button type="submit">Agregar ítem</button>
        </form>
        <div className="text-import">
          <div>
            <h3>Importar pedido desde texto</h3>
            <p>Pegá un mensaje de WhatsApp o una lista libre. Vas a poder revisar los ítems antes de agregarlos.</p>
          </div>
          <textarea value={orderText} onChange={(event) => setOrderText(event.target.value)} placeholder={"Jorge:\n1 kg almendras\n500 gr nuez\n\nMamá:\n2 kg harina de almendra"} />
          <button className="secondary" disabled={!orderText.trim()} onClick={previewOrderText}>Previsualizar pedido</button>
          {!!importedItems.length && <ImportedItemsPreview items={importedItems} updateItem={updateImportedItem} removeItem={(id) => setImportedItems((current) => current.filter((item) => item.id !== id))} addItems={addImportedItems} />}
        </div>
        {!items.length ? <Empty text="Todavía no hay productos en el pedido." /> : (
          <>
            <div className="table-wrap"><table><thead><tr><th>Comprador</th><th>Producto</th><th>Cantidad</th><th>Unidad</th><th></th></tr></thead><tbody>
              {items.map((item) => <tr key={item.id}><td>{item.buyer}</td><td>{item.product}</td><td>{item.quantity}</td><td>{item.unit}</td><td><button className="danger ghost" onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))}>Quitar</button></td></tr>)}
            </tbody></table></div>
            <button className="danger secondary clear-order" onClick={() => setItems([])}>Limpiar pedido completo</button>
          </>
        )}
      </section>

      <section id="reporte">
        <div className="section-title">
          <div><span className="step">3</span><h2>Reporte de compra</h2></div>
          <button disabled={!items.length} onClick={() => downloadStrategyCsv(strategy, suppliers)}>Descargar CSV</button>
        </div>
        <div className="metrics">
          <Metric label="Total estrategia óptima" value={money.format(strategy.optimalTotal)} />
          <Metric label="Ítems sin precio comparable" value={String(unresolved.length)} />
          <Metric label="Proveedores elegidos" value={String(Object.keys(strategy.totalsBySupplier).length)} />
          <Metric label="Ahorro vs. proveedor único" value={strategy.bestSingleSupplier ? money.format(strategy.bestSingleSupplier.total - strategy.optimalTotal) : "No disponible"} />
        </div>
        {!items.length ? <Empty text="El reporte aparecerá cuando cargues el pedido." /> : (
          <>
            <div className="table-wrap report"><table><thead><tr><th>Comprador</th><th>Producto</th><th>Pedido</th><th>Mejor proveedor</th><th>Archivo origen</th><th>Precio normalizado</th><th>Segundo proveedor</th><th>Diferencia</th><th>Subtotal</th></tr></thead><tbody>
              {strategy.comparisons.map((comparison) => <tr className={comparison.unresolved ? "unresolved" : ""} key={comparison.item.id}>
                <td>{comparison.item.buyer}</td><td>{comparison.item.product}</td><td>{comparison.item.quantity} {comparison.item.unit}</td><td>{comparison.best ? supplierName(comparison.best.supplierId) : "Sin coincidencia"}</td>
                <td>{comparison.best ? `${comparison.best.fileName} · fila ${comparison.best.sourceRow}` : "Sin coincidencia"}</td><td>{comparison.best ? `${money.format(comparison.best.normalizedUnitPrice)} / ${comparison.best.baseUnit}` : "—"}</td>
                <td>{comparison.second ? supplierName(comparison.second.supplierId) : "—"}</td><td>{percent(comparison.spreadPercent)}</td><td>{comparison.best ? money.format(comparison.best.subtotal) : "—"}</td>
              </tr>)}
            </tbody></table></div>
            <div className="summary-grid">
              <Summary title="Total por comprador" entries={strategy.totalsByBuyer} formatKey={(key) => key} />
              <Summary title="Total por proveedor" entries={strategy.totalsBySupplier} formatKey={supplierName} />
              <article className="summary"><h3>Proveedor único</h3>{strategy.bestSingleSupplier ? <p><strong>{supplierName(strategy.bestSingleSupplier.supplierId)}</strong><span>{money.format(strategy.bestSingleSupplier.total)}</span></p> : <small>Ningún proveedor cubre todo el pedido.</small>}</article>
            </div>
          </>
        )}
      </section>
      <footer>Se guardan solo datos procesados en este navegador. Los archivos originales no se conservan.</footer>
    </main>
  );
}

function EditablePriceRows({ list, updateRow, addRow, removeRow }: { list: PriceList; updateRow: (listId: string, rowId: string, patch: Partial<PriceRow>) => void; addRow: (listId: string) => void; removeRow: (listId: string, rowId: string) => void }) {
  return <div className="table-wrap compact"><table><thead><tr><th>Fila</th><th>Producto</th><th>Precio</th><th>Unidad</th><th>Contenido</th><th></th></tr></thead><tbody>
    {list.rows.map((row) => <tr key={row.id} className={row.warnings.length ? "unresolved" : ""}><td>{row.sourceRow}</td>
      <td><input value={row.product} onChange={(event) => updateRow(list.id, row.id, { product: event.target.value })} /></td>
      <td><input type="number" min="0" step="any" value={row.price} onChange={(event) => updateRow(list.id, row.id, { price: Number(event.target.value) })} /></td>
      <td><select value={row.unit} onChange={(event) => updateRow(list.id, row.id, { unit: event.target.value as Unit })}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></td>
      <td><input type="number" min="0.001" step="any" value={row.packageSize} onChange={(event) => updateRow(list.id, row.id, { packageSize: Number(event.target.value) })} /></td>
      <td><button className="danger ghost" onClick={() => removeRow(list.id, row.id)}>Quitar</button></td>
    </tr>)}
  </tbody></table><button className="secondary add-row" onClick={() => addRow(list.id)}>Agregar fila</button></div>;
}

function ImportedItemsPreview({ items, updateItem, removeItem, addItems }: { items: PurchaseItem[]; updateItem: (id: string, patch: Partial<PurchaseItem>) => void; removeItem: (id: string) => void; addItems: () => void }) {
  return <div className="import-preview">
    <div className="preview-title"><strong>Revisá los ítems detectados</strong><span>{items.length} ítems</span></div>
    <div className="table-wrap"><table><thead><tr><th>Comprador</th><th>Producto</th><th>Cantidad</th><th>Unidad</th><th></th></tr></thead><tbody>
      {items.map((item) => <tr key={item.id}>
        <td><input value={item.buyer} onChange={(event) => updateItem(item.id, { buyer: event.target.value })} /></td>
        <td><input value={item.product} onChange={(event) => updateItem(item.id, { product: event.target.value })} /></td>
        <td><input type="number" min="0.001" step="any" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) })} /></td>
        <td><select value={item.unit} onChange={(event) => updateItem(item.id, { unit: event.target.value as Unit })}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></td>
        <td><button className="danger ghost" onClick={() => removeItem(item.id)}>Quitar</button></td>
      </tr>)}
    </tbody></table></div>
    <button onClick={addItems}>Agregar ítems al pedido</button>
  </div>;
}

function Empty({ text }: { text: string }) { return <div className="empty">{text}</div>; }
function Metric({ label, value }: { label: string; value: string }) { return <article className="metric"><span>{label}</span><strong>{value}</strong></article>; }
function Summary({ title, entries, formatKey }: { title: string; entries: Record<string, number>; formatKey: (key: string) => string }) {
  return <article className="summary"><h3>{title}</h3>{Object.entries(entries).length ? Object.entries(entries).map(([key, value]) => <p key={key}><strong>{formatKey(key)}</strong><span>{money.format(value)}</span></p>) : <small>Sin totales disponibles.</small>}</article>;
}

function emptyRow(sourceRow: number): PriceRow {
  return { id: crypto.randomUUID(), product: "", price: 0, unit: "unit", packageSize: 1, sourceRow, warnings: [] };
}
