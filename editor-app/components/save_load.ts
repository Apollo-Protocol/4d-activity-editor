export function saveFile (data: string, filename: string, type: string): void {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const anch = document.createElement("a");

    anch.href = url;
    anch.setAttribute("download", filename);
    anch.click();
    setTimeout(() => URL.revokeObjectURL(url), 200);
}

export async function loadFile (accept: string): Promise<File> {
    const dialog = document.createElement("input");
    dialog.type = "file";
    dialog.accept = accept;

    return await new Promise((resolve, reject) => {
        dialog.onchange = (ev: any) => {
            const file = ev.target.files[0];
            if (file == null)
                reject("No file selected");
            else
                resolve(file);
        };
        dialog.click();
    });
}

