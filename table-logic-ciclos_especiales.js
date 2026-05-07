// Logica dedicada para la tabla ciclos_especiales
let tableColumns = [];
let currentData = [];
let filteredData = [];
let resolvedPrimaryKey = null;

document.addEventListener('DOMContentLoaded', function() {
    loadData();
});

function inferPrimaryKey(columns) {
    if (!Array.isArray(columns) || columns.length === 0) return 'id';
    if (columns.includes('id')) return 'id';
    const prefixedId = columns.find(col => /^id_/i.test(col));
    return prefixedId || columns[0];
}

function getPrimaryKey() {
    return resolvedPrimaryKey || 'id';
}

async function loadData() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const tableContainer = document.getElementById('tableContainer');

    if (loadingIndicator) loadingIndicator.style.display = 'block';
    tableContainer.innerHTML = '';

    try {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .limit(500);

        if (error) throw error;

        currentData = data || [];
        filteredData = [...currentData];

        if (currentData.length > 0) {
            tableColumns = Object.keys(currentData[0]);
            resolvedPrimaryKey = inferPrimaryKey(tableColumns);
            populateFilterColumns();
            applyFilter();
        } else {
            tableColumns = [];
            populateFilterColumns();
            updateFilterResultCount(0);
            tableContainer.innerHTML = '<div class="no-data">No hay registros en ' + TABLE_TITLE + '</div>';
        }
    } catch (error) {
        handleError(error, 'al cargar datos de ciclos_especiales');
        tableContainer.innerHTML = '<div class="error">Error cargando datos: ' + (error.message || error) + '</div>';
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

function formatColumnName(col) {
    return String(col).replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function formatValue(value, columnName) {
    if (value === null || value === undefined) return '-';

    const normalizedColumn = String(columnName || '').toLowerCase();
    if (normalizedColumn === 'firma') {
        const signatureUrls = getSignatureUrls(value);
        if (signatureUrls.length > 0) {
            const firstUrl = signatureUrls[0];
            return '<a href="' + firstUrl + '" target="_blank" rel="noopener noreferrer">Ver</a>';
        }
    }

    if (typeof value === 'boolean') return value ? 'SI' : 'NO';
    if (columnName.includes('fecha') || columnName.includes('date') || columnName.includes('_at')) {
        return formatDate(value);
    }
    if (typeof value === 'object') return JSON.stringify(value);
    const stringValue = String(value);
    return stringValue.length > 80 ? stringValue.substring(0, 80) + '...' : stringValue;
}

function renderTable(data) {
    const tableContainer = document.getElementById('tableContainer');

    if (!Array.isArray(data) || data.length === 0) {
        tableContainer.innerHTML = '<div class="no-data">No hay registros en ' + TABLE_TITLE + '</div>';
        return;
    }

    const primaryKey = getPrimaryKey();
    const visibleColumns = tableColumns.filter(col => col !== primaryKey);

    let html = '<table class="data-table"><thead><tr>';
    visibleColumns.forEach(col => {
        html += '<th>' + formatColumnName(col) + '</th>';
    });
    html += '<th>Acciones</th></tr></thead><tbody>';

    data.forEach(row => {
        const rowId = row[primaryKey];
        html += '<tr>';
        visibleColumns.forEach(col => {
            html += '<td>' + formatValue(row[col], col) + '</td>';
        });

        const rowPayload = JSON.stringify(row).replace(/'/g, '&apos;');
        html += '<td class="actions">';
        html += '<button class="btn btn-primary btn-sm" onclick=\'editRecord(' + rowPayload + ')\'>Editar</button> ';
        html += '<button class="btn btn-danger btn-sm" onclick=\'deleteRecord(' + JSON.stringify(rowId) + ')\'>Eliminar</button>';
        html += '</td></tr>';
    });

    html += '</tbody></table>';
    tableContainer.innerHTML = html;
}

function populateFilterColumns() {
    const filterColumn = document.getElementById('filterColumn');
    if (!filterColumn) return;

    const selected = filterColumn.value;
    filterColumn.innerHTML = '<option value="">Todas las columnas</option>';

    tableColumns.forEach(col => {
        const option = document.createElement('option');
        option.value = col;
        option.textContent = formatColumnName(col);
        filterColumn.appendChild(option);
    });

    filterColumn.value = tableColumns.includes(selected) ? selected : '';
}

function updateFilterResultCount(count) {
    const countEl = document.getElementById('filterResultCount');
    if (!countEl) return;
    countEl.textContent = 'Registros visibles: ' + count;
}

function applyFilter() {
    if (!Array.isArray(currentData) || currentData.length === 0) {
        filteredData = [];
        renderTable(filteredData);
        updateFilterResultCount(0);
        return;
    }

    const searchText = (document.getElementById('filterSearch')?.value || '').trim().toLowerCase();
    const selectedColumn = document.getElementById('filterColumn')?.value || '';

    if (!searchText) {
        filteredData = [...currentData];
        renderTable(filteredData);
        updateFilterResultCount(filteredData.length);
        return;
    }

    filteredData = currentData.filter(row => {
        if (selectedColumn) {
            const value = row[selectedColumn];
            return value != null && String(value).toLowerCase().includes(searchText);
        }

        return tableColumns.some(col => {
            const value = row[col];
            return value != null && String(value).toLowerCase().includes(searchText);
        });
    });

    renderTable(filteredData);
    updateFilterResultCount(filteredData.length);
}

function clearFilter() {
    const filterSearch = document.getElementById('filterSearch');
    const filterColumn = document.getElementById('filterColumn');
    if (filterSearch) filterSearch.value = '';
    if (filterColumn) filterColumn.value = '';
    applyFilter();
}

function splitSignatureValues(rawValue) {
    if (!rawValue) return [];
    if (Array.isArray(rawValue)) {
        return rawValue.map(v => String(v).trim()).filter(Boolean);
    }

    return String(rawValue)
        .split(/[\n,;|]+/)
        .map(v => v.trim())
        .filter(Boolean);
}

function getSignatureUrls(rawValue) {
    return splitSignatureValues(rawValue).filter(value => /^https?:\/\//i.test(value));
}

async function blobToImage(blob) {
    return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = function() {
            URL.revokeObjectURL(objectUrl);
            resolve(img);
        };
        img.onerror = function() {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('No se pudo decodificar imagen.'));
        };
        img.src = objectUrl;
    });
}

async function buildCombinedSignatureImage(urls) {
    if (!urls || urls.length === 0) return null;

    const loadedImages = [];
    for (const url of urls) {
        try {
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) continue;

            const blob = await response.blob();
            if (!blob.type.startsWith('image/')) continue;

            const img = await blobToImage(blob);
            loadedImages.push(img);
        } catch (_) {
            // Si una URL falla, se omite y se continua con las restantes.
        }
    }

    if (loadedImages.length === 0) return null;

    const targetWidth = 220;
    const gap = 8;
    const scaledSizes = loadedImages.map(img => {
        const safeWidth = img.width || targetWidth;
        const safeHeight = img.height || 60;
        const height = Math.max(30, Math.round((safeHeight * targetWidth) / safeWidth));
        return { width: targetWidth, height };
    });

    const totalHeight = scaledSizes.reduce((acc, size) => acc + size.height, 0) + (loadedImages.length - 1) * gap;
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = totalHeight;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let currentY = 0;
    loadedImages.forEach((img, index) => {
        const size = scaledSizes[index];
        ctx.drawImage(img, 0, currentY, size.width, size.height);
        currentY += size.height + gap;
    });

    return {
        dataUrl: canvas.toDataURL('image/png'),
        width: canvas.width,
        height: canvas.height
    };
}

function toMultilineContract(contratoValue) {
    if (!contratoValue) return '';

    return String(contratoValue)
        .split(/[\s,;|]+/)
        .map(v => v.trim())
        .filter(Boolean)
        .join('\n');
}

async function exportFilteredToExcel() {
    if (!window.ExcelJS) {
        showMessage('No se pudo cargar la libreria de Excel.', 'error');
        return;
    }

    if (!filteredData || filteredData.length === 0) {
        showMessage('No hay datos filtrados para exportar.', 'warning');
        return;
    }

    const primaryKey = getPrimaryKey();
    const exportColumns = tableColumns.filter(col => col !== primaryKey);
    const firmaColumnName = exportColumns.find(col => col.toLowerCase() === 'firma') || null;
    const contratoColumnName = exportColumns.find(col => col.toLowerCase() === 'contrato') || null;

    try {
        showMessage('Preparando exportacion de datos filtrados...', 'info');

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Ciclos Especiales');

        worksheet.columns = exportColumns.map(col => ({
            header: formatColumnName(col),
            key: col,
            width: col.toLowerCase() === 'firma' ? 36 : 24
        }));

        const firmaColumnIndex = firmaColumnName ? exportColumns.indexOf(firmaColumnName) + 1 : -1;
        const contratoColumnIndex = contratoColumnName ? exportColumns.indexOf(contratoColumnName) + 1 : -1;

        for (const rowData of filteredData) {
            const rowPayload = {};

            exportColumns.forEach(col => {
                if (contratoColumnName && col === contratoColumnName) {
                    rowPayload[col] = toMultilineContract(rowData[col]);
                    return;
                }

                if (firmaColumnName && col === firmaColumnName) {
                    rowPayload[col] = '';
                    return;
                }

                const rawValue = rowData[col];
                rowPayload[col] = rawValue == null ? '' : String(rawValue);
            });

            const excelRow = worksheet.addRow(rowPayload);

            if (contratoColumnIndex > 0) {
                const contratoCell = excelRow.getCell(contratoColumnIndex);
                contratoCell.alignment = { vertical: 'top', wrapText: true };
            }

            if (firmaColumnName && firmaColumnIndex > 0) {
                const firmaUrls = getSignatureUrls(rowData[firmaColumnName]);
                if (firmaUrls.length > 0) {
                    const combinedImage = await buildCombinedSignatureImage(firmaUrls);
                    if (combinedImage) {
                        const imageId = workbook.addImage({
                            base64: combinedImage.dataUrl,
                            extension: 'png'
                        });

                        const excelRowNumber = excelRow.number;
                        const baseRowHeightPoints = Math.max(90, Math.round(combinedImage.height * 0.75));
                        worksheet.getRow(excelRowNumber).height = baseRowHeightPoints;

                        worksheet.addImage(imageId, {
                            tl: { col: firmaColumnIndex - 1 + 0.05, row: excelRowNumber - 1 + 0.05 },
                            ext: {
                                width: Math.min(combinedImage.width, 230),
                                height: Math.min(combinedImage.height, 240)
                            }
                        });
                    }
                }
            }
        }

        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1F4E78' }
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 24;

        worksheet.views = [{ state: 'frozen', ySplit: 1 }];

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        link.href = url;
        link.download = 'ciclos_especiales_filtrado_' + timestamp + '.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showMessage('Exportacion completada.', 'success');
    } catch (error) {
        console.error('Error exportando Excel:', error);
        showMessage('No se pudo exportar: ' + (error.message || error), 'error');
    }
}

async function exportAllToExcel() {
    if (!window.ExcelJS) {
        console.error('ExcelJS no cargado');
        alert('No se pudo cargar la libreria de Excel. Intenta recargar la página.');
        return;
    }

    try {
        console.log('Iniciando exportación completa...');
        showMessage('Descargando TODOS los datos de la tabla (puede tomar un momento)...', 'info');

        const primaryKey = getPrimaryKey();
        
        // Cargar todos los datos sin límite
        console.log('Consultando tabla:', TABLE_NAME);
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*');

        if (error) {
            console.error('Error de Supabase:', error);
            throw error;
        }
        
        if (!data || data.length === 0) {
            showMessage('No hay datos en la tabla para exportar.', 'warning');
            return;
        }

        console.log('Datos descargados:', data.length, 'registros');

        const allData = data;
        const allColumns = tableColumns.length > 0 ? tableColumns : Object.keys(allData[0]);
        const exportColumns = allColumns.filter(col => col !== primaryKey);
        const firmaColumnName = exportColumns.find(col => col.toLowerCase() === 'firma') || null;
        const contratoColumnName = exportColumns.find(col => col.toLowerCase() === 'contrato') || null;

        showMessage('Preparando exportacion de ' + allData.length + ' registros...', 'info');

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Ciclos Especiales');

        worksheet.columns = exportColumns.map(col => ({
            header: formatColumnName(col),
            key: col,
            width: col.toLowerCase() === 'firma' ? 36 : 24
        }));

        const firmaColumnIndex = firmaColumnName ? exportColumns.indexOf(firmaColumnName) + 1 : -1;
        const contratoColumnIndex = contratoColumnName ? exportColumns.indexOf(contratoColumnName) + 1 : -1;

        console.log('Procesando', allData.length, 'filas...');

        for (const rowData of allData) {
            const rowPayload = {};

            exportColumns.forEach(col => {
                if (contratoColumnName && col === contratoColumnName) {
                    rowPayload[col] = toMultilineContract(rowData[col]);
                    return;
                }

                if (firmaColumnName && col === firmaColumnName) {
                    rowPayload[col] = '';
                    return;
                }

                const rawValue = rowData[col];
                rowPayload[col] = rawValue == null ? '' : String(rawValue);
            });

            const excelRow = worksheet.addRow(rowPayload);

            if (contratoColumnIndex > 0) {
                const contratoCell = excelRow.getCell(contratoColumnIndex);
                contratoCell.alignment = { vertical: 'top', wrapText: true };
            }

            if (firmaColumnName && firmaColumnIndex > 0) {
                try {
                    const firmaUrls = getSignatureUrls(rowData[firmaColumnName]);
                    if (firmaUrls.length > 0) {
                        const combinedImage = await buildCombinedSignatureImage(firmaUrls);
                        if (combinedImage) {
                            const imageId = workbook.addImage({
                                base64: combinedImage.dataUrl,
                                extension: 'png'
                            });

                            const excelRowNumber = excelRow.number;
                            const baseRowHeightPoints = Math.max(90, Math.round(combinedImage.height * 0.75));
                            worksheet.getRow(excelRowNumber).height = baseRowHeightPoints;

                            worksheet.addImage(imageId, {
                                tl: { col: firmaColumnIndex - 1 + 0.05, row: excelRowNumber - 1 + 0.05 },
                                ext: {
                                    width: Math.min(combinedImage.width, 230),
                                    height: Math.min(combinedImage.height, 240)
                                }
                            });
                        }
                    }
                } catch (imgError) {
                    console.warn('No se pudo procesar firma:', imgError);
                }
            }
        }

        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1F4E78' }
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 24;

        worksheet.views = [{ state: 'frozen', ySplit: 1 }];

        console.log('Generando Excel...');
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        link.href = url;
        link.download = 'ciclos_especiales_completa_' + timestamp + '.xlsx';
        document.body.appendChild(link);
        
        console.log('Descargando archivo...');
        link.click();
        
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showMessage('Exportacion de ' + allData.length + ' registros completada.', 'success');
        console.log('Exportación completada exitosamente');
    } catch (error) {
        console.error('Error en exportAllToExcel:', error);
        let errorMsg = 'No se pudo exportar';
        if (error.message) {
            errorMsg += ': ' + error.message;
        }
        showMessage(errorMsg, 'error');
    }
}

function openCreateModal() {
    if (!tableColumns.length && !currentData.length) {
        showMessage('No hay datos para inferir columnas. Agrega al menos un registro desde BD y recarga.', 'warning');
        return;
    }

    document.getElementById('modalTitle').textContent = 'Nuevo Registro';
    document.getElementById('recordId').value = '';
    document.getElementById('dataForm').reset();
    generateFormFields();
    document.getElementById('dataModal').classList.add('show');
}

function closeModal() {
    document.getElementById('dataModal').classList.remove('show');
}

function generateFormFields() {
    const formFields = document.getElementById('formFields');
    const primaryKey = getPrimaryKey();
    formFields.innerHTML = '';

    tableColumns.forEach(col => {
        if (col === 'created_at' || col === 'updated_at') return;

        const group = document.createElement('div');
        group.className = 'form-group';

        const label = document.createElement('label');
        label.setAttribute('for', col);
        label.textContent = formatColumnName(col);

        const input = document.createElement('input');
        input.type = 'text';
        input.id = col;
        input.name = col;

        if (col === primaryKey && document.getElementById('recordId').value) {
            input.disabled = true;
        }

        group.appendChild(label);
        group.appendChild(input);
        formFields.appendChild(group);
    });
}

function editRecord(record) {
    try {
        const primaryKey = getPrimaryKey();
        document.getElementById('modalTitle').textContent = 'Editar Registro';
        document.getElementById('recordId').value = record[primaryKey] ?? '';
        generateFormFields();

        tableColumns.forEach(col => {
            const input = document.getElementById(col);
            if (input && record[col] !== null && record[col] !== undefined) {
                input.value = record[col];
            }
        });

        document.getElementById('dataModal').classList.add('show');
    } catch (error) {
        handleError(error, 'al abrir edicion');
    }
}

async function deleteRecord(id) {
    if (id === null || id === undefined) {
        showMessage('No se pudo identificar la llave primaria para eliminar.', 'error');
        return;
    }

    if (!confirm('Esta seguro de eliminar este registro?')) return;

    try {
        const primaryKey = getPrimaryKey();
        const { error } = await supabase
            .from(TABLE_NAME)
            .delete()
            .eq(primaryKey, id);

        if (error) throw error;
        showMessage('Registro eliminado', 'success');
        loadData();
    } catch (error) {
        handleError(error, 'al eliminar registro');
    }
}

function formatDate(dateString) {
    if (!dateString) return '-';
    
    let dateOnly = dateString;
    if (typeof dateString === 'string') {
        const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
            dateOnly = match[0];
        }
    }
    
    const parts = dateOnly.split('-');
    const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    
    return date.toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

function showMessage(message, type = 'info') {
    const colors = {
        success: '#27ae60',
        error: '#e74c3c',
        info: '#3498db',
        warning: '#f39c12'
    };
    
    const msgDiv = document.createElement('div');
    msgDiv.textContent = message;
    msgDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 15px 20px;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(msgDiv);
    
    setTimeout(() => {
        msgDiv.style.opacity = '0';
        msgDiv.style.transition = 'opacity 0.3s';
        setTimeout(() => msgDiv.remove(), 300);
    }, 3000);
}

function handleError(error, context) {
    console.error(`Error ${context}:`, error);
    showMessage(`Error ${context}: ${error.message || error}`, 'error');
}

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('dataForm');
    const modal = document.getElementById('dataModal');

    if (form) {
        form.addEventListener('submit', async function(event) {
            event.preventDefault();

            const primaryKey = getPrimaryKey();
            const id = document.getElementById('recordId').value;
            const payload = {};

            tableColumns.forEach(col => {
                if (col === 'created_at' || col === 'updated_at') return;
                if (id && col === primaryKey) return;

                const input = document.getElementById(col);
                if (!input) return;

                payload[col] = input.value === '' ? null : input.value;
            });

            try {
                if (id) {
                    const { error } = await supabase
                        .from(TABLE_NAME)
                        .update(payload)
                        .eq(primaryKey, id);
                    if (error) throw error;
                    showMessage('Registro actualizado', 'success');
                } else {
                    const { error } = await supabase
                        .from(TABLE_NAME)
                        .insert([payload]);
                    if (error) throw error;
                    showMessage('Registro creado', 'success');
                }

                closeModal();
                loadData();
            } catch (error) {
                handleError(error, 'al guardar registro');
            }
        });
    }

    if (modal) {
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                closeModal();
            }
        });
    }
});