import tkinter as tk
from tkinter import ttk, messagebox
import json
import os

DB_FILE = "products.json"

CATEGORIES = ["", "Shoes", "Shorts", "Pants", "T-shirts", "Long-sleeve", "Hoodies", "Jackets", "Accessories"]
BATCHES    = ["", "Best Batch", "Budget Batch", "Random Batch"]

class AdminApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Jarvis Finder Admin Dashboard")
        self.geometry("1050x620")
        self.configure(bg="#121212")
        
        self.products = []
        self.load_data()

        style = ttk.Style(self)
        style.theme_use('clam')
        
        tk.Label(self, text="Admin Products Management", font=("Inter", 20, "bold"),
                 bg="#121212", fg="white").pack(pady=20)
        
        frame = tk.Frame(self, bg="#121212")
        frame.pack(fill=tk.BOTH, expand=True, padx=20)
        
        columns = ("id", "title", "price", "category", "batch")
        self.tree = ttk.Treeview(frame, columns=columns, show="headings", height=15)
        self.tree.heading("id",       text="ID")
        self.tree.heading("title",    text="Title")
        self.tree.heading("price",    text="Price")
        self.tree.heading("category", text="Category")
        self.tree.heading("batch",    text="Batch")
        
        self.tree.column("id",       width=40,  anchor=tk.CENTER)
        self.tree.column("title",    width=380, anchor=tk.W)
        self.tree.column("price",    width=100, anchor=tk.CENTER)
        self.tree.column("category", width=120, anchor=tk.CENTER)
        self.tree.column("batch",    width=130, anchor=tk.CENTER)
        
        style.configure("Treeview", background="#18181A", foreground="#ffffff",
                         fieldbackground="#18181A", bordercolor="#27272A")
        style.configure("Treeview.Heading", background="#27272A", foreground="white")
        style.map("Treeview", background=[("selected", "#3b82f6")])

        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        scrollbar = ttk.Scrollbar(frame, orient=tk.VERTICAL, command=self.tree.yview)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.tree.configure(yscrollcommand=scrollbar.set)
        
        self.refresh_table()

        btn_frame = tk.Frame(self, bg="#121212")
        btn_frame.pack(fill=tk.X, padx=20, pady=20)
        
        tk.Button(btn_frame, text="Add Product", command=self.add_product,
                  bg="white", fg="black", font=("Arial", 10, "bold"),
                  padx=10, pady=5).pack(side=tk.LEFT, padx=5)
        
        tk.Button(btn_frame, text="Edit Selected", command=self.edit_product,
                  bg="#f59e0b", fg="white", font=("Arial", 10, "bold"),
                  padx=10, pady=5).pack(side=tk.LEFT, padx=5)
        
        tk.Button(btn_frame, text="Delete Selected", command=self.del_product,
                  bg="#ef4444", fg="white", font=("Arial", 10, "bold"),
                  padx=10, pady=5).pack(side=tk.LEFT, padx=5)
        
        tk.Button(btn_frame, text="Save to Database", command=self.save_data,
                  bg="#3b82f6", fg="white", font=("Arial", 10, "bold"),
                  padx=10, pady=5).pack(side=tk.RIGHT, padx=5)

    # ── Data ──────────────────────────────────────────────────────────────
    def load_data(self):
        if not os.path.exists(DB_FILE):
            self.products = []
            return
        try:
            with open(DB_FILE, "r", encoding="utf-8") as f:
                self.products = json.load(f)
        except Exception as e:
            messagebox.showerror("Error", f"Could not load {DB_FILE}: {e}")
            self.products = []

    def save_data(self):
        try:
            with open(DB_FILE, "w", encoding="utf-8") as f:
                json.dump(self.products, f, indent=4, ensure_ascii=False)
            messagebox.showinfo("Success", "Products database successfully updated!")
        except Exception as e:
            messagebox.showerror("Error", f"Could not save data: {e}")

    def refresh_table(self):
        for item in self.tree.get_children():
            self.tree.delete(item)
        for idx, prod in enumerate(self.products):
            self.tree.insert("", tk.END, values=(
                idx,
                prod.get("title",    ""),
                prod.get("price",    ""),
                prod.get("category", ""),
                prod.get("batch",    ""),
            ))

    # ── Product form (shared by Add / Edit) ───────────────────────────────
    def open_form(self, title="Add New Product", product=None):
        win = tk.Toplevel(self)
        win.title(title)
        win.geometry("420x580")
        win.configure(bg="#121212")
        win.grab_set()

        def lbl(text):
            tk.Label(win, text=text, bg="#121212", fg="white",
                     font=("Arial", 10)).pack(pady=(10, 2))

        lbl("Title:")
        e_title = tk.Entry(win, width=48)
        e_title.pack()

        lbl("Price (CNY, numeric):")
        e_price = tk.Entry(win, width=48)
        e_price.pack()

        lbl("Image URL (https://...):")
        e_img = tk.Entry(win, width=48)
        e_img.insert(0, "https://")
        e_img.pack()

        lbl("Kakobuy Link (Buy Now):")
        e_kakobuy = tk.Entry(win, width=48)
        e_kakobuy.pack()

        lbl("Picks.ly Link (QC):")
        e_picksly = tk.Entry(win, width=48)
        e_picksly.pack()

        lbl("Category:")
        cat_var = tk.StringVar()
        cat_menu = ttk.Combobox(win, textvariable=cat_var, values=CATEGORIES,
                                state="readonly", width=46)
        cat_menu.pack()

        lbl("Batch / Quality:")
        batch_var = tk.StringVar()
        batch_menu = ttk.Combobox(win, textvariable=batch_var, values=BATCHES,
                                  state="readonly", width=46)
        batch_menu.pack()

        # Pre-fill if editing
        if product:
            e_title.insert(0,   product.get("title",    ""))
            e_price.insert(0,   product.get("price",    ""))
            e_img.delete(0, tk.END)
            e_img.insert(0,     product.get("img",      "https://"))
            e_kakobuy.insert(0, product.get("kakobuy",  ""))
            e_picksly.insert(0, product.get("picksly",  ""))
            cat_var.set(        product.get("category", ""))
            batch_var.set(      product.get("batch",    ""))

        result: list = []

        def on_save():
            t_ = e_title.get().strip()
            p_ = e_price.get().strip()
            if not t_ or not p_:
                messagebox.showwarning("Warning", "Title and Price are required.")
                return
            result.append({
                "title":    t_,
                "price":    p_,
                "img":      e_img.get().strip(),
                "kakobuy":  e_kakobuy.get().strip(),
                "picksly":  e_picksly.get().strip(),
                "category": cat_var.get(),
                "batch":    batch_var.get(),
            })
            win.destroy()

        tk.Button(win, text="Save", command=on_save,
                  bg="#3b82f6", fg="white",
                  font=("Arial", 10, "bold"), pady=5).pack(pady=22)

        win.wait_window()
        return result[0] if result else None

    # ── Actions ───────────────────────────────────────────────────────────
    def add_product(self):
        data = self.open_form("Add New Product")
        if data:
            self.products.append(data)
            self.refresh_table()

    def edit_product(self):
        selected = self.tree.selection()
        if not selected:
            messagebox.showwarning("Warning", "Please select a product to edit.")
            return
        idx = int(self.tree.item(selected[0], "values")[0])
        data = self.open_form("Edit Product", product=self.products[idx])
        if data:
            self.products[idx] = data
            self.refresh_table()

    def del_product(self):
        selected = self.tree.selection()
        if not selected:
            messagebox.showwarning("Warning", "Please select a product to delete.")
            return
        idx = int(self.tree.item(selected[0], "values")[0])
        if messagebox.askyesno("Confirm", f"Delete \"{self.products[idx].get('title','')}\"?"):
            self.products.pop(idx)
            self.refresh_table()

if __name__ == "__main__":
    app = AdminApp()
    app.mainloop()