const defaultCustomers = [
    { account: 'l063_gftth_honglt85', name: 'LÊ THỊ HỒNG', phone: '0396268846', address: '20 Thôn Liên châu Liên Đầm Di Linh Lâm Đồng', amount: 165000 },
    { account: 'l063_gftth_loitq5', name: 'TRẦN QUỐC LỢI', phone: '355764532', address: '80 Quốc Lộ 20, Thôn 10, Thôn 3 Liên Đầm', amount: 210000 }
];

// Load data from localStorage or use default
let customers = JSON.parse(localStorage.getItem('viettel_customers')) || defaultCustomers;

const dom = {
    tableBody: document.querySelector('#customerTable tbody'),
    btnAdd: document.getElementById('btnAddRow'),
    btnPrint: document.getElementById('btnPrint'),
    btnExport: document.getElementById('btnExport'),
    btnImport: document.getElementById('btnImport'),
    btnDownloadSample: document.getElementById('btnDownloadSample'),
    fileInput: document.getElementById('fileInput'),
    printArea: document.getElementById('printArea'),
    inputs: {
        collectorName: document.getElementById('collectorName'),
        collectorPhone: document.getElementById('collectorPhone'),
        unitName: document.getElementById('unitName'),
        billingMonth: document.getElementById('billingMonth')
    }
};

// Initialize
function init() {
    // LOGIN LOGIC
    const loginOverlay = document.getElementById('login-overlay');
    const passwordInput = document.getElementById('passwordInput');
    const btnLogin = document.getElementById('btnLogin');
    const loginError = document.getElementById('loginError');
    const appContainer = document.querySelector('.app-container');

    // Check if already logged in (Session Storage)
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        if (loginOverlay) loginOverlay.style.display = 'none';
        if (appContainer) appContainer.style.setProperty('display', 'flex', 'important');
    }

    function checkLogin() {
        const password = passwordInput.value;
        if (password === '1122@@44') {
            sessionStorage.setItem('isLoggedIn', 'true');
            if (loginOverlay) loginOverlay.style.display = 'none';
            if (appContainer) appContainer.style.setProperty('display', 'flex', 'important');
        } else {
            loginError.style.display = 'block';
        }
    }

    if (btnLogin) {
        btnLogin.addEventListener('click', checkLogin);
    }

    if (passwordInput) {
        passwordInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                checkLogin();
            }
        });
    }

    renderTable();
    dom.btnAdd.addEventListener('click', addRow);
    dom.btnPrint.addEventListener('click', handlePrint);
    dom.btnExport.addEventListener('click', saveToLocalStorage);

    // Import Logic
    dom.btnImport.addEventListener('click', () => dom.fileInput.click());
    dom.fileInput.addEventListener('change', handleExcelUpload);
    dom.btnDownloadSample.addEventListener('click', downloadSampleExcel);

    // Save settings on change
    Object.values(dom.inputs).forEach(input => {
        input.addEventListener('change', saveToLocalStorage);
        // Load saved value if exists
        const saved = localStorage.getItem('viettel_setting_' + input.id);
        if (saved) input.value = saved;
    });

    // Navigation Logic
    const navReceipt = document.getElementById('nav-receipt');
    const navExcel = document.getElementById('nav-excel');
    const viewReceipt = document.getElementById('view-receipt');
    const viewExcel = document.getElementById('view-excel');
    const sidebarReceiptSettings = document.getElementById('sidebar-receipt-settings');
    const sidebarReceiptActions = document.getElementById('sidebar-receipt-actions');

    if (navReceipt && navExcel) {
        navReceipt.addEventListener('click', () => {
            viewReceipt.classList.add('active');
            viewExcel.classList.remove('active');

            if (sidebarReceiptSettings) sidebarReceiptSettings.style.display = 'block';
            if (sidebarReceiptActions) sidebarReceiptActions.style.display = 'flex';

            navReceipt.style.background = '#e63946';
            navReceipt.style.color = 'white';
            navExcel.style.background = 'transparent';
            navExcel.style.color = '#333';
        });

        navExcel.addEventListener('click', () => {
            viewExcel.classList.add('active');
            viewReceipt.classList.remove('active');

            if (sidebarReceiptSettings) sidebarReceiptSettings.style.display = 'none';
            if (sidebarReceiptActions) sidebarReceiptActions.style.display = 'none';

            navExcel.style.background = '#e63946';
            navExcel.style.color = 'white';
            navReceipt.style.background = 'transparent';
            navReceipt.style.color = '#333';
        });
    }
}

function handleExcelUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Get first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to JSON
        // header: 1 means array of arrays. This is safer to find the header row.
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (rawData.length === 0) {
            alert("File Excel trống!");
            return;
        }

        // Simple Heuristic to match columns:
        // Assume order or find header row.
        // Let's assume the user uses a format similar to screen:
        // STT | Mã KH | Tên KH | SĐT | Địa Chỉ | Tiền

        // Try to identify header row by keywords
        let headerRowIndex = 0;
        let foundHeader = false;

        for (let i = 0; i < Math.min(rawData.length, 10); i++) {
            const row = rawData[i].map(c => String(c).toLowerCase());
            if (row.some(c => c.includes('mã') || c.includes('account') || c.includes('tên') || c.includes('cước'))) {
                headerRowIndex = i;
                foundHeader = true;
                break;
            }
        }

        // If we found a header, we skip it. If not, we assume row 0 is header or data? 
        // Let's assume if foundHeader, process next rows.
        // If !foundHeader, assume row 0 is data if it looks like data? Safer to just prompt or import all.
        // Let's just import from headerRowIndex + 1

        const newCustomers = [];
        const startRow = foundHeader ? headerRowIndex + 1 : 0;

        for (let i = startRow; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row || row.length < 2) continue; // Skip empty rows

            // Map columns loosely. 
            // We need 5 items: Account, Name, Phone, Address, Amount
            // If row has >= 5 items: 
            // Often STT is first. So index 0.
            // Let's try to map indices based on position if we don't have better mapping.
            // Configurable? No, too complex.
            // Assumption: STT (opt), Account, Name, Phone, Address, Amount

            let acc, name, phone, addr, amt;

            // Heuristic strategies
            if (row.length >= 6) {
                // With STT: 0=STT, 1=Acc, 2=Name, 3=Phone, 4=Addr, 5=Amt (or 5=Last)
                acc = row[1];
                name = row[2];
                phone = row[3];
                addr = row[4];
                amt = row[5];
            } else if (row.length === 5) {
                // No STT: 0=Acc, 1=Name, 2=Phone, 3=Addr, 4=Amt
                acc = row[0];
                name = row[1];
                phone = row[2];
                addr = row[3];
                amt = row[4];
            } else {
                // Fallback
                acc = row[0];
                name = row[1];
                phone = 0;
                addr = "";
                amt = 0;
            }

            // Cleanup data
            if (acc) {
                // Handle Excel errors or invalid amounts
                let amountClean = 0;
                if (typeof amt === 'string') {
                    // Check for Excel errors like #NAME?, #N/A
                    if (amt.startsWith('#')) amountClean = 0;
                    else amountClean = parseInt(amt.replace(/\D/g, '')) || 0;
                } else {
                    amountClean = parseInt(amt) || 0;
                }

                newCustomers.push({
                    account: String(acc || ''),
                    name: String(name || ''),
                    phone: String(phone || ''),
                    address: String(addr || ''),
                    amount: amountClean
                });
            }
        }

        if (newCustomers.length > 0) {
            if (confirm(`Tìm thấy ${newCustomers.length} khách hàng. Bạn có muốn thay thế danh sách hiện tại không?\n(Cancel để thêm vào danh sách hiện có)`)) {
                customers = newCustomers;
            } else {
                customers = [...customers, ...newCustomers];
            }
            renderTable();
            saveToLocalStorage();
            alert('Nhập dữ liệu thành công!');
        } else {
            alert('Không tìm thấy dữ liệu hợp lệ!');
        }

        // Reset input so we can select same file again
        dom.fileInput.value = '';
    };
    reader.readAsArrayBuffer(file);
}

function saveToLocalStorage() {
    localStorage.setItem('viettel_customers', JSON.stringify(customers));
    Object.keys(dom.inputs).forEach(key => {
        localStorage.setItem('viettel_setting_' + dom.inputs[key].id, dom.inputs[key].value);
    });
}

function renderTable() {
    dom.tableBody.innerHTML = '';
    customers.forEach((cust, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td><input class="cell-input" value="${cust.account}" onchange="updateCustomer(${index}, 'account', this.value)"></td>
            <td><input class="cell-input" value="${cust.name}" onchange="updateCustomer(${index}, 'name', this.value)"></td>
            <td><input class="cell-input" value="${cust.phone}" onchange="updateCustomer(${index}, 'phone', this.value)"></td>
            <td><input class="cell-input" value="${cust.address}" onchange="updateCustomer(${index}, 'address', this.value)"></td>
            <td><input class="cell-input" type="number" value="${cust.amount}" onchange="updateCustomer(${index}, 'amount', this.value)"></td>
            <td style="text-align: center;">
                <button class="btn-delete" onclick="deleteRow(${index})">🗑️</button>
            </td>
        `;
        dom.tableBody.appendChild(tr);
    });
}

function addRow() {
    customers.push({ account: '', name: '', phone: '', address: '', amount: 0 });
    renderTable();
}

window.updateCustomer = (index, field, value) => {
    customers[index][field] = value;
    saveToLocalStorage();
};

window.deleteRow = (index) => {
    if (confirm('Bạn có chắc muốn xóa khách hàng này?')) {
        customers.splice(index, 1);
        renderTable();
        saveToLocalStorage();
    }
};

// --- NUMBER TO TEXT LOGIC (Vietnamese) ---
const digitMap = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const tierMap = ['', 'nghìn', 'triệu', 'tỷ'];

function readGroup(group) {
    const [c, b, a] = group; // tram, chuc, donvi
    let str = '';

    // Hundred
    if (c !== undefined) {
        str += digitMap[c] + ' trăm ';
        if (b === 0 && a !== 0) str += 'lẻ ';
    }

    // Ten
    if (b !== undefined) {
        if (b === 0) {
            // handled above by 'lẻ'
        } else if (b === 1) {
            str += 'mười ';
        } else {
            str += digitMap[b] + ' mươi ';
        }
    }

    // Unit
    if (a !== undefined) {
        if (a === 0) {
            // do nothing usually
        } else if (a === 1) {
            if (b > 1) str += 'mốt';
            else str += 'một';
        } else if (a === 5) {
            if (b > 0) str += 'lăm';
            else str += 'năm';
        } else {
            str += digitMap[a];
        }
    }

    return str;
}

function moneyToWords(number) {
    if (!number || number == 0) return 'Không đồng';

    let str = number.toString();
    const groups = [];
    while (str.length > 0) {
        groups.push(str.slice(-3).split('').map(Number));
        str = str.slice(0, -3);
    }

    let result = '';
    groups.forEach((group, index) => {
        const groupText = readGroup(group.reverse()); // reverse back to normal order [3, 2, 1] -> [1, 2, 3]?? wait. 
        // Input: 123456 -> groups: [[4,5,6], [1,2,3]]
        // Group logic needs [1, 2, 3] where 1 is hundred.
        // My split logic produced [4,5,6]. 
        // Let's re-verify the logic.
        // Slice(-3) of 123456 is 456. Split -> ['4','5','6']. Map -> [4,5,6]. Correct.

        // Wait, readGroup expects [hundred, ten, unit].
        // If group is [4,5,6], c=4, b=5, a=6. Correct.
        // But if group is [1,2] (from 12), slice logic might be tricky.
        // 12345 -> last 3: 345. remaining: 12.
        // Next loop: 12. slice(-3) is 12. split -> [1,2].
        // [1,2] destructuring: c=1, b=2, a=undefined.
        // But 12 is 1 ten, 2 unit. 
        // My readGroup expects c to be hundred.
        // I need to padStart the group to length 3 with null/undefined if I use fixed positions
        // Or adjust logic.

        // Better approach:
        // Use a library-like simple approach or standard recursive. 
        // Quick fix: padStart logic.
    });

    // Let's rewrite a simpler reliable one for this task.
    // Basic implementation for < 100 billion is enough.
    return DocTienBangChu(number);
}

// Robust Function adapted for Vietnamese
function DocTienBangChu(SoTien) {
    var Lan = 0;
    var i = 0;
    var so = 0;
    var KetQua = "";
    var tmp = "";
    var ViTri = new Array();
    if (SoTien < 0) return "Số tiền âm !";
    if (SoTien == 0) return "Không đồng !";
    if (SoTien > 0) {
        so = SoTien;
    } else {
        so = -SoTien;
    }
    if (SoTien > 8999999999999999) {
        // limit
        return "Số quá lớn!";
    }
    ViTri[5] = Math.floor(so / 1000000000000000);
    if (isNaN(ViTri[5])) ViTri[5] = "0";
    so = so - parseFloat(ViTri[5].toString()) * 1000000000000000;
    ViTri[4] = Math.floor(so / 1000000000000);
    if (isNaN(ViTri[4])) ViTri[4] = "0";
    so = so - parseFloat(ViTri[4].toString()) * 1000000000000;
    ViTri[3] = Math.floor(so / 1000000000);
    if (isNaN(ViTri[3])) ViTri[3] = "0";
    so = so - parseFloat(ViTri[3].toString()) * 1000000000;
    ViTri[2] = Math.floor(so / 1000000);
    if (isNaN(ViTri[2])) ViTri[2] = "0";
    so = so - parseFloat(ViTri[2].toString()) * 1000000;
    ViTri[1] = Math.floor(so / 1000);
    if (isNaN(ViTri[1])) ViTri[1] = "0";
    so = so - parseFloat(ViTri[1].toString()) * 1000;
    ViTri[0] = Math.floor(so);
    if (ViTri[5] > 0) {
        Lan = 5;
    } else if (ViTri[4] > 0) {
        Lan = 4;
    } else if (ViTri[3] > 0) {
        Lan = 3;
    } else if (ViTri[2] > 0) {
        Lan = 2;
    } else if (ViTri[1] > 0) {
        Lan = 1;
    } else {
        Lan = 0;
    }
    for (i = Lan; i >= 0; i--) {
        tmp = DocSo3ChuSo(ViTri[i]);
        KetQua += tmp;
        if (ViTri[i] > 0) KetQua += Tien[i];
        if ((i > 0) && (tmp.length > 0)) KetQua += ','; // Comma between groups
    }
    if (KetQua.substring(KetQua.length - 1) == ',') {
        KetQua = KetQua.substring(0, KetQua.length - 1);
    }
    KetQua = KetQua.substring(1, 2).toUpperCase() + KetQua.substring(2);
    // Fix odd spacing
    KetQua = KetQua.replace(/, /g, ' ').replace(/  /g, ' ');
    return KetQua + ' đồng';
}

var ChuSo = new Array(" không ", " một ", " hai ", " ba ", " bốn ", " năm ", " sáu ", " bảy ", " tám ", " chín ");
var Tien = new Array("", " nghìn", " triệu", " tỷ", " nghìn tỷ", " triệu tỷ");

function DocSo3ChuSo(baso) {
    var tram;
    var chuc;
    var donvi;
    var KetQua = "";
    tram = parseInt(baso / 100);
    chuc = parseInt((baso % 100) / 10);
    donvi = baso % 10;
    if (tram == 0 && chuc == 0 && donvi == 0) return "";
    if (tram != 0) {
        KetQua += ChuSo[tram] + " trăm ";
        if ((chuc == 0) && (donvi != 0)) KetQua += " linh ";
    }
    if ((chuc != 0) && (chuc != 1)) {
        KetQua += ChuSo[chuc] + " mươi";
        if ((chuc == 0) && (donvi != 0)) KetQua = KetQua + " linh ";
    }
    if (chuc == 1) KetQua += " mười ";
    switch (donvi) {
        case 1:
            if ((chuc != 0) && (chuc != 1)) {
                KetQua += " mốt ";
            } else {
                KetQua += ChuSo[donvi];
            }
            break;
        case 5:
            if (chuc == 0) {
                KetQua += ChuSo[donvi];
            } else {
                KetQua += " lăm ";
            }
            break;
        default:
            if (donvi != 0) {
                KetQua += ChuSo[donvi];
            }
            break;
    }
    return KetQua;
}


// --- PRINT GENERATION ---
function handlePrint() {
    const collector = {
        name: dom.inputs.collectorName.value,
        phone: dom.inputs.collectorPhone.value,
        unit: dom.inputs.unitName.value
    };

    // Format Month
    const dateVal = new Date(dom.inputs.billingMonth.value);
    const monthStr = (dateVal.getMonth() + 1).toString().padStart(2, '0');
    const yearStr = dateVal.getFullYear();

    const today = new Date();
    const dayToday = today.getDate().toString().padStart(2, '0');
    const monthToday = (today.getMonth() + 1).toString().padStart(2, '0');
    const yearToday = today.getFullYear();

    let html = '';

    // Group into pages of 2
    for (let i = 0; i < customers.length; i += 2) {
        const batch = customers.slice(i, i + 2);

        html += '<div class="print-page">';

        batch.forEach((cust, index) => {
            // Global index for receipt number
            const globalIndex = i + index + 1;

            // Format money
            const moneyFormatted = parseInt(cust.amount).toLocaleString('vi-VN');
            const moneyText = DocTienBangChu(cust.amount);

            html += `
            <div class="receipt">
                <div class="header-row">
                    <div class="logo-section">
                        <img src="./viettel-logo-new.png" class="img-logo" alt="Viettel">
                        <div style="font-weight:bold; font-size:11pt;">TẬP ĐOÀN VIỄN THÔNG QUÂN ĐỘI</div>
                        <div>${collector.unit}</div>
                        <div style="font-size:9pt; font-style:italic;">Báo sự cố xin gọi: 1800.8119 hoặc ${collector.phone}</div>
                    </div>
                    <div class="receipt-title">
                        PHIẾU THU THÁNG ${monthToday === '01' ? '12' : (parseInt(monthToday) - 1).toString().padStart(2, '0')}
                    </div>
                    <div class="meta-section">
                        <div style="font-weight:bold;">Mẫu số 01 - TT</div>
                        <div>QĐ số: 15/2006/QĐ-BTC</div>
                        <div>Ngày 20 tháng 03 năm 2006</div>
                        <div>của Bộ trưởng Bộ Tài Chính</div>
                        <div style="margin-top:5px; font-weight:bold;">Số: ${globalIndex}</div>
                    </div>
                </div>

                <div class="row">
                    <div class="label">Họ tên người nộp tiền:</div>
                    <div class="value highlight-red">${cust.name}</div>
                </div>
                <div class="row">
                    <div class="label">Điện thoại KH:</div>
                    <div class="value">${cust.phone}</div>
                </div>
                <div class="row">
                    <div class="label">Số thuê bao đại diện:</div>
                    <div class="value" style="font-style:italic">${cust.account}</div>
                </div>
                <div class="row">
                    <div class="label">Địa chỉ:</div>
                    <div class="value">${cust.address}</div>
                </div>
                <div class="row">
                    <div class="label">Lý do nộp:</div>
                    <div class="value">Cước tháng ${monthStr}/${yearStr}</div>
                </div>
                <div class="row">
                    <div class="label">Số tiền:</div>
                    <div class="value" style="font-weight:bold;">${moneyFormatted}</div>
                </div>
                <div class="row">
                    <div class="label">Bằng chữ:</div>
                    <div class="value money-text" style="font-style:italic;">${moneyText}</div>
                </div>
                <div class="row">
                    <div class="label">Kèm theo:</div>
                    <div class="value">.................................................................................................</div>
                </div>
                <div class="row">
                    <div class="label">Đã nhận đủ số tiền (Bằng chữ):</div>
                    <div class="value">.................................................................................................</div>
                </div>

                <div class="signature-section">
                    <div class="sig-block" style="text-align:left;">
                        <div class="promo-section">
                            <div style="text-decoration:underline;">ƯU ĐÃI:</div>
                            <div>- Đóng cước trước để tặng 1-3 tháng</div>
                            <div>- Nhận lắp đặt camera bán sim mạng ô tô</div>
                            <div>- Bán sim số đẹp sim phong thủy giá rẻ</div>
                        </div>
                    </div>
                    <div class="sig-block">
                        <div style="font-style:italic;">Ngày ...... tháng ...... năm 20....</div>
                        <div class="sig-title">NGƯỜI NHẬN TIỀN</div>
                        <div style="margin-top:60px; font-weight:bold;">${collector.name}</div>
                        <div style="font-weight:bold;">${collector.phone}</div>
                    </div>
                </div>
            </div>
            `;
        });

        html += '</div>'; // End print-page
    }

    dom.printArea.innerHTML = html;
    window.print();
}


function downloadSampleExcel() {
    try {
        const ws_data = [
            ["Mã Khách Hàng (Account)", "Tên Khách Hàng", "SĐT Liên Hệ", "Địa Chỉ", "Tổng Cước"],
            ["T001_EXAMPLE", "NGUYỄN VĂN A", "0987654321", "123 Đường ABC, Hà Nội", 200000],
            ["T002_EXAMPLE", "TRẦN THỊ B", "0912345678", "456 Đường XYZ, TP.HCM", 150000]
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(ws_data);
        XLSX.utils.book_append_sheet(wb, ws, "Mau_Nhap_Lieu");
        XLSX.writeFile(wb, "Mau_Nhap_Lieu_Viettel.xlsx");
    } catch (e) {
        alert("Lỗi khi tải file mẫu: " + e.message);
        console.error(e);
    }
}

// Start
init();
