import os
import json
import re  # Added import for regex
import requests
from urllib.parse import urlsplit

import tkinter as tk
from tkinter import ttk, messagebox

DATA_FILE = "data.json"

def load_data():
    """
    Load data.json if it exists, else create a minimal structure.
    """
    if not os.path.exists(DATA_FILE):
        base_structure = {"filters": [], "groups": []}
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(base_structure, f, indent=2)
        return base_structure
    else:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)

def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def append_fidget_to_group(data, group_name, new_fidget):
    """
    Finds the group with exact 'name' == group_name and appends 'new_fidget' to its 'fidgets'.
    Returns True if found, else False.
    """
    for grp in data["groups"]:
        if grp.get("name", "") == group_name:
            if "fidgets" not in grp:
                grp["fidgets"] = []
            grp["fidgets"].append(new_fidget)
            return True
    return False

def ensure_dir_exists(path):
    """
    Make sure the directory for 'path' exists.
    Example: 'images/uqh/wispy.jpg' => create 'images/uqh' if needed.
    """
    dir_name = os.path.dirname(path)
    if dir_name and not os.path.exists(dir_name):
        os.makedirs(dir_name, exist_ok=True)

def download_image(url, dest_path):
    """
    Download the file at 'url' to local path 'dest_path' using requests.
    Overwrites if file exists.
    """
    ensure_dir_exists(dest_path)
    r = requests.get(url, stream=True, timeout=20)
    if r.status_code == 200:
        with open(dest_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)
    else:
        raise RuntimeError(f"HTTP {r.status_code} when downloading {url}")

def sanitize_filename(s):
    """
    Sanitize a string to be safe for filenames.
    Replaces spaces and invalid characters with underscores.
    Converts to lowercase.
    """
    return re.sub(r'[^A-Za-z0-9_-]', '_', s.lower())

# ---------------------------------------------------------------------------
# Custom AutocompleteCombobox
# ---------------------------------------------------------------------------
class AutocompleteCombobox(ttk.Combobox):
    """
    A Combobox that performs substring matching of the typed text against
    a completion list. On each keystroke, it updates the drop-down values.

    When a user selects an item from the dropdown (<<ComboboxSelected>>),
    we restore the full completion list.
    """
    def __init__(self, master=None, completevalues=None, **kwargs):
        super().__init__(master, **kwargs)
        # The original unfiltered list
        self._full_list = sorted(completevalues, key=str.lower) if completevalues else []
        self['values'] = self._full_list

        # Bind events
        self.bind('<KeyRelease>', self._on_keyrelease)
        # We'll also intercept combobox selection
        self.bind('<<ComboboxSelected>>', self._on_select)

    def set_completion_list(self, completion_list):
        """
        Update the full list and current combobox values.
        """
        self._full_list = sorted(completion_list, key=str.lower)
        self['values'] = self._full_list

    def _on_keyrelease(self, event):
        """
        Called on each key typed. We'll filter 'values' based on substring match.
        If exactly one match, we auto-complete.
        """
        if event.keysym in ("BackSpace", "Left", "Right", "Up", "Down", "Home", "End"):
            # Let user navigate or edit without messing
            return

        # Get the current text in the combobox
        typed = self.get().strip()
        if not typed:
            # If empty, restore full list
            self['values'] = self._full_list
            return

        # Substring matching
        matching = [s for s in self._full_list if typed.lower() in s.lower()]

        if matching:
            self['values'] = matching
        else:
            self['values'] = []

        # If exactly one match, auto-complete
        if len(matching) == 1:
            self.set(matching[0])
            self.icursor(tk.END)
            # We can also fake a '<<ComboboxSelected>>' event so the app sees the selection
            self.event_generate('<<ComboboxSelected>>')
        else:
            self.set(typed)  # keep user-typed text
            self.icursor(tk.END)

    def _on_select(self, event):
        """
        Called when user picks from the dropdown or we auto-complete to one item.
        We restore the full list, so next time user opens the dropdown, they see everything.
        """
        # user selected or we auto-completed => restore full list
        self['values'] = self._full_list

# ---------------------------------------------------------------------------
# Main Fidget App
# ---------------------------------------------------------------------------
class FidgetApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Fidget Entry (Autocomplete + Smart Image Naming)")
        self.geometry("600x420")

        # Load data at startup
        self.data = load_data()

        # Build sorted list of group names
        self.all_group_names = sorted([g["name"] for g in self.data["groups"]], key=str.lower)

        if not self.all_group_names:
            messagebox.showwarning("No Groups", "No groups found in data.json. Please add them manually first.")

        self.current_base_path = ""

        self.create_widgets()

    def create_widgets(self):
        row = 0

        # Group AutocompleteCombobox
        ttk.Label(self, text="Select Group:").grid(row=row, column=0, padx=10, pady=10, sticky="e")
        self.group_var = tk.StringVar()
        self.group_ac = AutocompleteCombobox(
            self, 
            completevalues=self.all_group_names, 
            textvariable=self.group_var, 
            width=40,
            state="normal"
        )
        self.group_ac.grid(row=row, column=1, padx=10, pady=10, sticky="w")
        self.group_ac.bind('<<ComboboxSelected>>', self._on_group_combo_select)
        row += 1

        # Base path label
        ttk.Label(self, text="Base Folder:").grid(row=row, column=0, padx=10, pady=5, sticky="e")
        self.base_label_var = tk.StringVar(value="(none)")
        ttk.Label(self, textvariable=self.base_label_var, foreground="blue").grid(row=row, column=1, padx=10, pady=5, sticky="w")
        row += 1

        # Fidget Name
        ttk.Label(self, text="Fidget Name:").grid(row=row, column=0, padx=10, pady=5, sticky="e")
        self.fidget_name_var = tk.StringVar()
        ttk.Entry(self, textvariable=self.fidget_name_var, width=40).grid(row=row, column=1, padx=10, pady=5, sticky="w")
        row += 1

        # Image
        ttk.Label(self, text="Image (URL or path):").grid(row=row, column=0, padx=10, pady=5, sticky="e")
        self.fidget_image_var = tk.StringVar()
        ttk.Entry(self, textvariable=self.fidget_image_var, width=40).grid(row=row, column=1, padx=10, pady=5, sticky="w")
        row += 1

        # Dimensions
        ttk.Label(self, text="Dimensions:").grid(row=row, column=0, padx=10, pady=5, sticky="e")
        self.fidget_dims_var = tk.StringVar()
        ttk.Entry(self, textvariable=self.fidget_dims_var, width=40).grid(row=row, column=1, padx=10, pady=5, sticky="w")
        row += 1

        # Weight
        ttk.Label(self, text="Weight:").grid(row=row, column=0, padx=10, pady=5, sticky="e")
        self.fidget_weight_var = tk.StringVar()
        ttk.Entry(self, textvariable=self.fidget_weight_var, width=40).grid(row=row, column=1, padx=10, pady=5, sticky="w")
        row += 1

        # Materials
        ttk.Label(self, text="Materials (comma-separated):").grid(row=row, column=0, padx=10, pady=5, sticky="e")
        self.fidget_materials_var = tk.StringVar()
        ttk.Entry(self, textvariable=self.fidget_materials_var, width=40).grid(row=row, column=1, padx=10, pady=5, sticky="w")
        row += 1

        # Buttons
        add_button = ttk.Button(self, text="Add Fidget", command=self.add_fidget)
        add_button.grid(row=row, column=0, padx=10, pady=20, sticky="e")

        done_button = ttk.Button(self, text="Done", command=self.quit)
        done_button.grid(row=row, column=1, padx=10, pady=20, sticky="w")

    def _on_group_combo_select(self, event):
        """
        Called specifically when the user picks from the combobox or we auto-complete to a single item.
        We'll figure out the base folder from the group's 'image' field.
        """
        selected_group = self.group_var.get().strip()
        self.current_base_path = ""

        for grp in self.data["groups"]:
            if grp["name"] == selected_group:
                group_image = grp.get("image", "")
                base_folder = os.path.dirname(group_image)
                if base_folder:
                    self.current_base_path = base_folder
                break

        if self.current_base_path:
            self.base_label_var.set(self.current_base_path)
            self.fidget_image_var.set(self.current_base_path + "/")
        else:
            self.base_label_var.set("(none)")
            self.fidget_image_var.set("")

    def add_fidget(self):
        group_name = self.group_var.get().strip()
        if not group_name:
            messagebox.showerror("Error", "Please select or type a group name.")
            return

        fidget_name = self.fidget_name_var.get().strip()
        if not fidget_name:
            messagebox.showerror("Error", "Fidget name is required.")
            return

        image_val = self.fidget_image_var.get().strip()
        dims_val = self.fidget_dims_var.get().strip()
        weight_val = self.fidget_weight_var.get().strip()
        materials_raw = self.fidget_materials_var.get().strip()
        fidget_materials = [m.strip() for m in materials_raw.split(",")] if materials_raw else []

        # Attempt to download if it's an HTTP(S) URL
        local_image_path = image_val
        if image_val.lower().startswith("http"):
            try:
                parts = urlsplit(image_val)
                # Extract file extension
                _, ext = os.path.splitext(parts.path)
                if not ext:
                    ext = ".jpg"  # Default extension if none found

                # Sanitize fidget name and materials
                sanitized_name = sanitize_filename(fidget_name)
                sanitized_materials = [sanitize_filename(m) for m in fidget_materials]
                
                # Combine fidget name and materials for filename
                if sanitized_materials:
                    # Join materials with underscores
                    materials_part = "_".join(sanitized_materials)
                    filename = f"{sanitized_name}_{materials_part}{ext}"
                else:
                    filename = f"{sanitized_name}{ext}"

                if self.current_base_path:
                    local_image_path = os.path.join(self.current_base_path, filename)
                else:
                    local_image_path = filename

                download_image(image_val, local_image_path)
                print(f"Downloaded {image_val} => {local_image_path}")

            except Exception as e:
                messagebox.showerror("Download Error", f"Failed to download image:\n{e}")
                return

        # Build the fidget dict
        new_fidget = {
            "name": fidget_name,
            "image": local_image_path,
            "dimensions": dims_val,
            "weight": weight_val,
            "material": fidget_materials
        }

        success = append_fidget_to_group(self.data, group_name, new_fidget)
        if success:
            save_data(self.data)
            messagebox.showinfo("Success", f"Fidget '{fidget_name}' added to '{group_name}'.")

            # Clear fields for next entry
            self.fidget_name_var.set("")
            self.fidget_dims_var.set("")
            self.fidget_weight_var.set("")
            self.fidget_materials_var.set("")
            if self.current_base_path:
                self.fidget_image_var.set(self.current_base_path + "/")
            else:
                self.fidget_image_var.set("")
        else:
            messagebox.showerror("Group Not Found",
                f"Group '{group_name}' not found in data.json.\n"
                "Ensure the group name is correct and matches exactly."
            )

def main():
    app = FidgetApp()
    app.mainloop()

if __name__ == "__main__":
    main()
