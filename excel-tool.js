document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements - Prefix 'et-'
    const inputFile = document.getElementById('et-inputFile');
    const fileStatus = document.getElementById('et-fileStatus');
    const filterRowsContainer = document.getElementById('et-filterRows');
    const addFilterRowBtn = document.getElementById('et-addFilterRow');
    const outputModeRadios = document.getElementsByName('et-outputMode');
    const splitSettings = document.getElementById('et-splitSettings');
    const splitColumnInput = document.getElementById('et-splitColumn');
    const btnRun = document.getElementById('et-btnRun');
    const statusMessage = document.getElementById('et-statusMessage');
    const loadingSpinner = document.getElementById('et-loadingSpinner');

    // State
    let fileBuffer = null; // Store raw buffer to "clone" workbook by reloading
    let originalFileName = "";

    // Initialize
    function init() {
        if (!filterRowsContainer) return; // Guard in case of missing DOM
        createFilterRow("Mã CTV", "SANGLT_LDG_CNKD,TAMDT_LDG_CNKD,LINHPM_LDG_CNKD,LONGNT_LDG_CNKD,NHUANVD_LDG_CNKD,ANLT_LDG_CNKD");
        createFilterRow();
        createFilterRow();
        createFilterRow();
        createFilterRow(); // Total 5 rows
    }

    // 1. File Handling
    if (inputFile) {
        inputFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            fileStatus.textContent = `Đang đọc: ${file.name}...`;
            statusMessage.textContent = "Đang đọc file...";

            try {
                fileBuffer = await file.arrayBuffer();
                originalFileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension

                // Quick check to see if valid excel (optional, ExcelJS throws on load)
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(fileBuffer);

                fileStatus.textContent = `Đã tải: ${file.name} (${workbook.worksheets.length} sheet)`;
                statusMessage.textContent = "Đã đọc xong file. Sẵn sàng lọc.";
            } catch (err) {
                console.error(err);
                alert("Lỗi đọc file Excel: " + err.message);
                fileStatus.textContent = "Lỗi đọc file!";
                fileBuffer = null;
            }
        });
    }

    // 2. Dynamic UI
    if (addFilterRowBtn) {
        addFilterRowBtn.addEventListener('click', () => createFilterRow());
    }

    function createFilterRow(col = "", val = "") {
        const div = document.createElement('div');
        // Add 'tw-' prefix to Tailwind classes
        div.className = "tw-grid tw-grid-cols-12 tw-gap-4 tw-mb-3 filter-row tw-items-center";
        div.innerHTML = `
            <div class="tw-col-span-4">
                <input type="text" value="${col}" placeholder="Tên cột..." class="filter-col tw-w-full tw-border tw-rounded tw-px-3 tw-py-2 tw-text-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500">
            </div>
            <div class="tw-col-span-8">
                <input type="text" value="${val}" placeholder="Giá trị 1, Giá trị 2..." class="filter-val tw-w-full tw-border tw-rounded tw-px-3 tw-py-2 tw-text-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500">
            </div>
        `;
        filterRowsContainer.appendChild(div);
    }

    // Toggle Split Settings
    if (outputModeRadios) {
        Array.from(outputModeRadios).forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === 'auto') {
                    splitSettings.classList.remove('tw-hidden');
                } else {
                    splitSettings.classList.add('tw-hidden');
                }
            });
        });
    }

    // 3. Core Logic
    if (btnRun) {
        btnRun.addEventListener('click', async () => {
            if (!fileBuffer) {
                alert("Vui lòng chọn file Excel trước!");
                return;
            }

            setLoading(true);
            statusMessage.textContent = "Đang xử lý...";

            // Allow UI to update before heavy processing
            setTimeout(async () => {
                try {
                    await processExcel();
                } catch (err) {
                    console.error(err);
                    alert("Đã xảy ra lỗi: " + err.message);
                    statusMessage.textContent = "Lỗi xử lý!";
                } finally {
                    setLoading(false);
                }
            }, 100);
        });
    }

    async function processExcel() {
        const filters = getFilters();
        const mode = document.querySelector('input[name="et-outputMode"]:checked').value;
        const splitCol = splitColumnInput.value.trim();

        // Validate
        if (mode === 'auto' && !splitCol) {
            throw new Error("Vui lòng nhập 'Cột để tách file'!");
        }

        // Common logic: We match column names to indices for each sheet
        // and identify rows to KEEP or DELETE.

        // We handle modes differently to optimize.
        if (mode === 'merge') {
            await processMergeMode(filters);
        } else if (mode === 'auto') {
            await processAutoSplitMode(filters, splitCol);
        }
    }

    async function processMergeMode(filters) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(fileBuffer);

        let totalRowsKept = 0;

        for (const worksheet of workbook.worksheets) {
            const keptCount = filterWorksheet(worksheet, filters);
            totalRowsKept += keptCount;
        }

        if (totalRowsKept === 0) {
            alert("Không tìm thấy dữ liệu nào phù hợp!");
            return;
        }

        // Save
        const buffer = await workbook.xlsx.writeBuffer();
        // Filename per user request: "xuất file thêm tên file gốc vô trong điều kiện filter"
        // Interpreted as: OutputFilename = [OriginalName]_Filtered.xlsx
        const outName = `${originalFileName}_Filtered.xlsx`;
        saveAs(new Blob([buffer]), outName);
        statusMessage.textContent = `Đã tải xuống: ${outName}`;
    }

    async function processAutoSplitMode(filters, splitCol) {
        // 1. First pass: Scan to find all unique values in the split column across matching rows
        // We shouldn't load workbook N times yet. Load once to map values.
        const scanWorkbook = new ExcelJS.Workbook();
        await scanWorkbook.xlsx.load(fileBuffer);

        const uniqueValues = new Set();

        for (const worksheet of scanWorkbook.worksheets) {
            // Map header
            const headerRow = worksheet.getRow(1);
            const headers = [];
            headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                headers[colNumber] = cell.value ? String(cell.value).trim() : "";
            });

            const splitColIdx = headers.indexOf(splitCol);
            if (splitColIdx === -1) continue; // Skip sheet if missing split col

            // Identify rows that WOULD be kept by filters
            // and collect their split-column value

            // Map filter columns
            const filterIndices = mapFiltersToIndices(headers, filters);
            if (filterIndices === null) continue; // Missing required filter col

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Skip header

                if (checkRowPasses(row, filterIndices)) {
                    // Get split value
                    const cell = row.getCell(splitColIdx);
                    const val = cell.value ? String(cell.value).trim() : "Untitled";
                    uniqueValues.add(val);
                }
            });
        }

        const valuesList = Array.from(uniqueValues);
        if (valuesList.length === 0) {
            alert("Không tìm thấy dữ liệu nào phù hợp để tách!");
            return;
        }

        statusMessage.textContent = `Tìm thấy ${valuesList.length} nhóm dữ liệu. Đang tách...`;

        // 2. Process each unique value
        // This is the heavy part. For each value, we reload original, strict filter, save.

        const zip = new JSZip();
        let computedCount = 0;

        for (const val of valuesList) {
            const safeVal = val.replace(/[^a-z0-9\-_]/gi, '_');

            // Reload fresh workbook
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(fileBuffer);

            // Filter: Keep row IF (Global Filters Pass) AND (SplitCol == val)
            let hasData = false;

            for (const worksheet of workbook.worksheets) {
                const headerRow = worksheet.getRow(1);
                const headers = [];
                headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    headers[colNumber] = cell.value ? String(cell.value).trim() : "";
                });

                const splitColIdx = headers.indexOf(splitCol);

                // If split col missing in this sheet, decide strategy.
                // If sheet doesn't have split col, we can't split it by value. 
                // We usually remove strictly.
                if (splitColIdx === -1) {
                    // Remove all data rows? Or keep?
                    // Safest: Remove all rows because they don't belong to "Group X"
                    worksheet.spliceRows(2, worksheet.rowCount - 1);
                    continue;
                }

                // Map filters
                const filterIndices = mapFiltersToIndices(headers, filters);

                // Loop backwards to splice
                // rowCount changes as we delete, so strictly loop backwards
                for (let i = worksheet.rowCount; i >= 2; i--) {
                    const row = worksheet.getRow(i);

                    // 1. Check Global Filters
                    let passes = true;
                    if (filterIndices) {
                        passes = checkRowPasses(row, filterIndices);
                    } else {
                        passes = false; // Missing required filter col
                    }

                    // 2. Check Split Value
                    if (passes) {
                        const cell = row.getCell(splitColIdx);
                        const cellVal = cell.value ? String(cell.value).trim() : "Untitled";
                        if (cellVal !== val) {
                            passes = false;
                        }
                    }

                    if (!passes) {
                        worksheet.spliceRows(i, 1);
                    } else {
                        hasData = true;
                    }
                }
            }

            if (hasData) {
                const buffer = await workbook.xlsx.writeBuffer();
                // Filename: [OriginalName]_[Value].xlsx
                const filename = `${originalFileName}_${safeVal}.xlsx`;

                if (valuesList.length === 1) {
                    saveAs(new Blob([buffer]), filename);
                    statusMessage.textContent = `Đã tách và tải xuống: ${filename}`;
                    return; // Done
                } else {
                    zip.file(filename, buffer);
                }
            }
            computedCount++;
            statusMessage.textContent = `Đang xử lý ${computedCount}/${valuesList.length}...`;
        }

        if (valuesList.length > 1) {
            statusMessage.textContent = "Đang nén file...";
            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, `${originalFileName}_SplitFiles.zip`);
            statusMessage.textContent = `Đã tải xuống zip gồm ${valuesList.length} file.`;
        }
    }

    // Helpers

    // Returns { colIdx, values[] } or null if missing required col
    function mapFiltersToIndices(headers, filters) {
        const indices = [];
        for (const f of filters) {
            const idx = headers.indexOf(f.column);
            if (idx === -1) {
                // If a specified filter column is missing, we treat this as "Matches Nothing" 
                // for the whole sheet usually? 
                // Or return null to signal "this sheet lacks columns needed for filtering"
                return null;
            }
            // ExcelJS is 1-based for columns usually in .getColumn(), 
            // but here 'idx' is 0-based from array. 
            // details: 
            // headers[0] is col 1. headers[N] is col N+1.
            indices.push({ colIndex: idx, values: f.values });
        }
        return indices;
    }

    // Returns TRUE if row matches filters
    function checkRowPasses(row, filterIndices) {
        if (!filterIndices) return false;

        for (const filter of filterIndices) {
            const cell = row.getCell(filter.colIndex);
            // .value can be null, number, string, object (hyperlink)
            // We need simple string rep
            let val = "";
            if (cell.value !== null && cell.value !== undefined) {
                if (typeof cell.value === 'object' && cell.value.text) {
                    val = cell.value.text; // Hyperlink
                } else {
                    val = String(cell.value);
                }
            }
            val = val.trim();

            // Check values
            // "OR within column"
            const match = filter.values.some(v => val.toLowerCase().includes(v.toLowerCase()));
            if (!match) return false;
        }
        return true;
    }

    function filterWorksheet(worksheet, filters) {
        const headerRow = worksheet.getRow(1);
        const headers = [];
        headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            headers[colNumber] = cell.value ? String(cell.value).trim() : "";
        });

        const filterIndices = mapFiltersToIndices(headers, filters);

        // If indices is null, it means a required column is missing.
        // So all rows fail.
        if (!filterIndices) {
            // preserve header, delete everything else
            if (worksheet.rowCount > 1) {
                worksheet.spliceRows(2, worksheet.rowCount - 1);
            }
            return 0;
        }

        // Loop backwards
        let kept = 0;
        for (let i = worksheet.rowCount; i >= 2; i--) {
            const row = worksheet.getRow(i);
            if (!checkRowPasses(row, filterIndices)) {
                worksheet.spliceRows(i, 1);
            } else {
                kept++;
            }
        }
        return kept;
    }

    function getFilters() {
        // Scope to local container if possible or just use class
        const rows = filterRowsContainer.querySelectorAll('.filter-row');
        const filters = [];
        rows.forEach(row => {
            const col = row.querySelector('.filter-col').value.trim();
            const valStr = row.querySelector('.filter-val').value.trim();

            if (col && valStr) {
                const values = valStr.split(',').map(s => s.trim()).filter(s => s !== "");
                if (values.length > 0) {
                    filters.push({ column: col, values: values });
                }
            }
        });
        return filters;
    }

    function setLoading(isLoading) {
        if (isLoading) {
            loadingSpinner.classList.remove('tw-hidden');
            btnRun.classList.add('tw-opacity-75', 'tw-cursor-not-allowed');
            btnRun.disabled = true;
        } else {
            loadingSpinner.classList.add('tw-hidden');
            btnRun.classList.remove('tw-opacity-75', 'tw-cursor-not-allowed');
            btnRun.disabled = false;
        }
    }

    // Init
    init();

});
