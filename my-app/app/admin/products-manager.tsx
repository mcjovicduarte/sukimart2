"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  AlertTriangle,
  Boxes,
  Eye,
  Package,
  PackagePlus,
  PackageX,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { countLabel, formatDateTime, formatPeso } from "@/utils/format";
import {
  PRODUCT_IMAGE_LIBRARY,
  resolveProductImage,
} from "@/utils/product-images";
import ProductImage from "../product-image";
import {
  Alert,
  ConfirmDialog,
  EmptyState,
  LoadingBlock,
  Modal,
  PageHeader,
} from "./ui";
import styles from "./admin.module.css";

type Product = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  image_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type ProductForm = {
  name: string;
  description: string;
  category: string;
  price: string;
  stock: string;
  image_url: string;
  active: boolean;
};

type AvailabilityFilter =
  | "all"
  | "in-stock"
  | "low-stock"
  | "out-of-stock"
  | "hidden";

const emptyForm: ProductForm = {
  name: "",
  description: "",
  category: "General",
  price: "",
  stock: "0",
  image_url: "",
  active: true,
};

const AVAILABILITY_OPTIONS: Array<{
  value: AvailabilityFilter;
  label: string;
}> = [
  { value: "all", label: "All availability" },
  { value: "in-stock", label: "In stock" },
  { value: "low-stock", label: "Low stock (5 or fewer)" },
  { value: "out-of-stock", label: "Out of stock" },
  { value: "hidden", label: "Hidden from shop" },
];

const LOW_STOCK_LIMIT = 5;

function stockTone(stock: number) {
  if (stock === 0) return styles.stockOut;
  if (stock <= LOW_STOCK_LIMIT) return styles.stockLow;
  return styles.stockOk;
}

function stockText(stock: number) {
  if (stock === 0) return "Out of stock";
  if (stock <= LOW_STOCK_LIMIT) return `${stock} left`;
  return `${stock} in stock`;
}

export default function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [availability, setAvailability] = useState<AvailabilityFilter>("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [viewing, setViewing] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [productResult, categoryResult] = await Promise.all([
      supabase
        .from("products")
        .select(
          "id,name,description,category,price,stock,image_url,active,created_at,updated_at",
        )
        .order("created_at", { ascending: false }),
      supabase.from("categories").select("name").order("name"),
    ]);

    setErrorMessage("");
    if (productResult.error) {
      setErrorMessage(productResult.error.message);
    } else {
      const rows = (productResult.data as unknown as Product[]) ?? [];
      setProducts(rows);
      setCategoryOptions((current) => {
        const names = new Set<string>(current);
        if (!categoryResult.error) {
          (categoryResult.data ?? []).forEach((row) => names.add(row.name));
        }
        rows.forEach((row) => names.add(row.category));
        return Array.from(names).sort((a, b) => a.localeCompare(b));
      });
    }

    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useEffect(() => {
    // Initial client-side fetch; all state updates happen after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    const refreshStock = async () => {
      const { data, error } = await createClient()
        .from("products")
        .select(
          "id,name,description,category,price,stock,image_url,active,created_at,updated_at",
        )
        .order("created_at", { ascending: false });
      if (!error) setProducts((data as Product[]) ?? []);
    };
    const timer = window.setInterval(() => void refreshStock(), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const categories = useMemo(() => {
    const names = new Set(categoryOptions);
    products.forEach((product) => names.add(product.category));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [categoryOptions, products]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        query === "" ||
        product.name.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query);

      const matchesCategory =
        categoryFilter === "all" || product.category === categoryFilter;

      const matchesAvailability =
        availability === "all" ||
        (availability === "in-stock" && product.active && product.stock > 0) ||
        (availability === "low-stock" &&
          product.active &&
          product.stock > 0 &&
          product.stock <= LOW_STOCK_LIMIT) ||
        (availability === "out-of-stock" && product.stock === 0) ||
        (availability === "hidden" && !product.active);

      return matchesSearch && matchesCategory && matchesAvailability;
    });
  }, [availability, categoryFilter, products, search]);

  const summary = useMemo(
    () => ({
      total: products.length,
      inStock: products.filter((product) => product.active && product.stock > 0)
        .length,
      lowStock: products.filter(
        (product) => product.stock > 0 && product.stock <= LOW_STOCK_LIMIT,
      ).length,
      outOfStock: products.filter((product) => product.stock === 0).length,
    }),
    [products],
  );

  const updateForm = <K extends keyof ProductForm>(
    field: K,
    value: ProductForm[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setMessage("");
    setErrorMessage("");
    setFormOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setForm({
      name: product.name,
      description: product.description,
      category: product.category,
      price: String(product.price),
      stock: String(product.stock),
      image_url: product.image_url ?? "",
      active: product.active,
    });
    setMessage("");
    setErrorMessage("");
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");

    const price = Number(form.price);
    const stock = Number(form.stock);

    if (!form.name.trim()) {
      setErrorMessage("Give the product a name before saving.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setErrorMessage("Enter a valid price of zero or more.");
      return;
    }
    if (!Number.isInteger(stock) || stock < 0) {
      setErrorMessage("Stock must be a whole number of zero or more.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category.trim() || "General",
      price,
      stock,
      image_url: form.image_url.trim() || null,
      active: form.active,
      updated_at: new Date().toISOString(),
    };

    const result = editing
      ? await supabase.from("products").update(payload).eq("id", editing.id)
      : await supabase.from("products").insert(payload);

    if (result.error) {
      setErrorMessage(result.error.message);
      setSaving(false);
      return;
    }

    setMessage(editing ? "Product updated." : "Product added to the shop.");
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setSaving(false);
    await load();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setErrorMessage("");
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", deleteTarget.id);

    if (error) {
      setErrorMessage(error.message);
      setDeleting(false);
      setDeleteTarget(null);
      return;
    }

    if (viewing?.id === deleteTarget.id) setViewing(null);
    setMessage(`"${deleteTarget.name}" was deleted.`);
    setDeleting(false);
    setDeleteTarget(null);
    await load();
  };

  const toggleVisibility = async (product: Product) => {
    setErrorMessage("");
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase
      .from("products")
      .update({ active: !product.active, updated_at: new Date().toISOString() })
      .eq("id", product.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setMessage(
      product.active
        ? `"${product.name}" is now hidden from the shop.`
        : `"${product.name}" is now visible in the shop.`,
    );
    await load();
  };

  return (
    <>
      <PageHeader
        eyebrow="Product management"
        title="Products and stock"
        description="Add products, update prices and stock, and control what shoppers see."
        actions={
          <>
            <button
              type="button"
              className={`${styles.button} ${styles.secondaryButton}`}
              onClick={() => void refresh()}
              disabled={refreshing}
            >
              <RefreshCw size={14} />
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
            <button
              type="button"
              className={`${styles.button} ${styles.primaryButton}`}
              onClick={openAdd}
            >
              <Plus size={15} />
              Add product
            </button>
          </>
        }
      />

      {message && <Alert tone="success">{message}</Alert>}
      {errorMessage && <Alert tone="error">{errorMessage}</Alert>}

      <section className={styles.statGrid} aria-label="Product summary">
        <article className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Total products</span>
            <span className={`${styles.statIcon} ${styles.toneIconGreen}`}>
              <Package size={16} />
            </span>
          </div>
          <strong className={styles.statValue}>{summary.total}</strong>
          <span className={styles.statHint}>Everything in your catalog</span>
        </article>
        <article className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Available now</span>
            <span className={`${styles.statIcon} ${styles.toneIconBlue}`}>
              <Boxes size={16} />
            </span>
          </div>
          <strong className={styles.statValue}>{summary.inStock}</strong>
          <span className={styles.statHint}>Visible and in stock</span>
        </article>
        <article className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Low stock</span>
            <span className={`${styles.statIcon} ${styles.toneIconAmber}`}>
              <AlertTriangle size={16} />
            </span>
          </div>
          <strong className={styles.statValue}>{summary.lowStock}</strong>
          <span className={styles.statHint}>Five pieces or fewer</span>
        </article>
        <article className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Out of stock</span>
            <span className={`${styles.statIcon} ${styles.toneIconRose}`}>
              <PackageX size={16} />
            </span>
          </div>
          <strong className={styles.statValue}>{summary.outOfStock}</strong>
          <span className={styles.statHint}>Needs restocking</span>
        </article>
      </section>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <label className={styles.searchField}>
            <Search size={15} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by product name, category, or description"
              aria-label="Search products"
            />
          </label>

          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <select
            value={availability}
            onChange={(event) =>
              setAvailability(event.target.value as AvailabilityFilter)
            }
            aria-label="Filter by availability"
          >
            {AVAILABILITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <span className={styles.toolbarCount}>
            {filtered.length} of {countLabel(products.length, "product")}
          </span>
        </div>

        {loading ? (
          <LoadingBlock label="Loading products…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<PackagePlus size={28} />}
            title={
              products.length === 0 ? "No products yet" : "No products match"
            }
            description={
              products.length === 0
                ? "Add your first product so customers can start ordering."
                : "Try a different search term or clear the filters to see everything."
            }
          />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Shop status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <button
                        type="button"
                        className={styles.productCell}
                        onClick={() => setViewing(product)}
                        style={{
                          padding: 0,
                          background: "none",
                          border: 0,
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <ProductImage
                          src={resolveProductImage(product)}
                          alt={product.name}
                          className={styles.thumb}
                        />
                        <span className={styles.productCellText}>
                          <strong>{product.name}</strong>
                          <small>
                            {product.description || "No description"}
                          </small>
                        </span>
                      </button>
                    </td>
                    <td>{product.category}</td>
                    <td>{formatPeso(product.price)}</td>
                    <td>
                      <span
                        className={`${styles.stock} ${stockTone(product.stock)}`}
                      >
                        {stockText(product.stock)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`${styles.badge} ${
                          product.active ? styles.toneDone : styles.toneMuted
                        }`}
                      >
                        {product.active ? "Visible" : "Hidden"}
                      </span>
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <button
                          type="button"
                          className={`${styles.button} ${styles.ghostButton} ${styles.smallButton}`}
                          onClick={() => setViewing(product)}
                        >
                          <Eye size={13} />
                          View
                        </button>
                        <button
                          type="button"
                          className={`${styles.button} ${styles.ghostButton} ${styles.smallButton}`}
                          onClick={() => openEdit(product)}
                        >
                          <Pencil size={13} />
                          Edit
                        </button>
                        <button
                          type="button"
                          className={`${styles.button} ${styles.ghostButton} ${styles.smallButton}`}
                          onClick={() => void toggleVisibility(product)}
                        >
                          {product.active ? "Hide" : "Show"}
                        </button>
                        <button
                          type="button"
                          className={`${styles.button} ${styles.ghostButton} ${styles.smallButton}`}
                          style={{ color: "var(--danger)" }}
                          onClick={() => setDeleteTarget(product)}
                        >
                          <Trash2 size={13} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? "Edit product" : "Add a product"}
        subtitle={
          editing
            ? "Changes are saved to the store immediately."
            : "New products appear in the customer shop as soon as they are visible."
        }
        wide
        footer={
          <>
            <button
              type="button"
              className={`${styles.button} ${styles.secondaryButton}`}
              onClick={closeForm}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="product-form"
              className={`${styles.button} ${styles.primaryButton}`}
              disabled={saving}
            >
              {saving && <span className={styles.spinner} aria-hidden="true" />}
              {saving ? "Saving…" : editing ? "Save changes" : "Add product"}
            </button>
          </>
        }
      >
        <form id="product-form" className={styles.form} onSubmit={saveProduct}>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Product name</span>
              <input
                required
                maxLength={120}
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                placeholder="e.g. Lucky Me Pancit Canton"
              />
            </label>
            <label className={styles.field}>
              <span>Category</span>
              <input
                list="product-category-options"
                maxLength={80}
                value={form.category}
                onChange={(event) => updateForm("category", event.target.value)}
                placeholder="e.g. Instant Noodles"
              />
              <datalist id="product-category-options">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </label>
            <label className={styles.field}>
              <span>Price (₱)</span>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(event) => updateForm("price", event.target.value)}
                placeholder="0.00"
              />
            </label>
            <label className={styles.field}>
              <span>Stock quantity</span>
              <input
                required
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={(event) => updateForm("stock", event.target.value)}
              />
            </label>
            <label className={`${styles.field} ${styles.formWide}`}>
              <span>Description</span>
              <textarea
                maxLength={500}
                value={form.description}
                onChange={(event) =>
                  updateForm("description", event.target.value)
                }
                placeholder="Short details customers will see on the product card."
              />
            </label>
          </div>

          <div className={styles.imageField}>
            <span className={styles.fieldLabel}>Product image</span>
            <div className={styles.imageRow}>
              <div className={styles.imagePreview}>
                <ProductImage
                  src={resolveProductImage({
                    name: form.name,
                    category: form.category,
                    image_url: form.image_url,
                  })}
                  alt="Product image preview"
                  className={styles.imagePreviewImage}
                />
              </div>
              <div className={styles.imageControls}>
                <input
                  type="text"
                  inputMode="url"
                  aria-label="Product image URL"
                  placeholder="https://example.com/product.jpg"
                  value={form.image_url}
                  onChange={(event) =>
                    updateForm("image_url", event.target.value)
                  }
                />
                <p className={styles.hint}>
                  Paste an image link or pick one from the Sukimart library.
                  Leave it empty to use artwork that matches the product name or
                  category.
                </p>
                <div className={styles.imageLibrary}>
                  {PRODUCT_IMAGE_LIBRARY.map((image) => {
                    const selected = form.image_url === image.src;
                    return (
                      <button
                        key={image.src}
                        type="button"
                        title={image.label}
                        aria-pressed={selected}
                        className={`${styles.libraryItem} ${
                          selected ? styles.libraryItemActive : ""
                        }`}
                        onClick={() => updateForm("image_url", image.src)}
                      >
                        <ProductImage
                          src={image.src}
                          alt={image.label}
                          className={styles.libraryThumb}
                        />
                        <span>{image.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => updateForm("active", event.target.checked)}
            />
            Show this product in the customer shop
          </label>
        </form>
      </Modal>

      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.name ?? "Product details"}
        subtitle={viewing ? viewing.category : undefined}
        footer={
          viewing ? (
            <>
              <button
                type="button"
                className={`${styles.button} ${styles.secondaryButton}`}
                onClick={() => {
                  const product = viewing;
                  setViewing(null);
                  openEdit(product);
                }}
              >
                <Pencil size={14} />
                Edit product
              </button>
              <button
                type="button"
                className={`${styles.button} ${styles.primaryButton}`}
                onClick={() => setViewing(null)}
              >
                Done
              </button>
            </>
          ) : undefined
        }
      >
        {viewing && (
          <div className={styles.viewProduct}>
            <div className={styles.viewProductImage}>
              <ProductImage
                src={resolveProductImage(viewing)}
                alt={viewing.name}
                className={styles.imagePreviewImage}
              />
            </div>
            <div className={styles.viewProductBody}>
              <div className={styles.inlineBadges}>
                <span
                  className={`${styles.badge} ${
                    viewing.active ? styles.toneDone : styles.toneMuted
                  }`}
                >
                  {viewing.active ? "Visible in shop" : "Hidden from shop"}
                </span>
                <span className={`${styles.stock} ${stockTone(viewing.stock)}`}>
                  {stockText(viewing.stock)}
                </span>
              </div>
              <p className={styles.viewDescription}>
                {viewing.description || "This product has no description yet."}
              </p>
              <div className={styles.detailGrid}>
                <div className={styles.detailBlock}>
                  <span className={styles.detailLabel}>Price</span>
                  <span className={styles.detailValue}>
                    {formatPeso(viewing.price)}
                  </span>
                </div>
                <div className={styles.detailBlock}>
                  <span className={styles.detailLabel}>Stock</span>
                  <span className={styles.detailValue}>
                    {viewing.stock} pieces
                  </span>
                </div>
                <div className={styles.detailBlock}>
                  <span className={styles.detailLabel}>Category</span>
                  <span className={styles.detailValue}>{viewing.category}</span>
                </div>
                <div className={styles.detailBlock}>
                  <span className={styles.detailLabel}>Last updated</span>
                  <span className={styles.detailValue}>
                    {formatDateTime(viewing.updated_at)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this product?"
        message={
          deleteTarget
            ? `"${deleteTarget.name}" will be removed from the shop. Past orders keep their recorded item names and prices. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete product"
        tone="danger"
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
    </>
  );
}
