document.addEventListener('DOMContentLoaded', function () {
    const request = indexedDB.open('ItemsDB', 4); // Increment version to update schema

    request.onupgradeneeded = function (event) {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('items')) {
            db.createObjectStore('items', { keyPath: 'articleId' });
        } else {
            // Ensure existing store is updated if needed
            const objectStore = event.target.transaction.objectStore('items');
            // No structural changes needed, but version bump ensures data consistency
        }
        console.log('Database setup complete');
    };

    request.onsuccess = function (event) {
        const db = event.target.result;
        console.log('Database opened successfully');

        // Display all items with checkboxes and upload forms for checked items
        displayItems(db);
    };

    request.onerror = function (event) {
        console.error('Database error:', event.target.errorCode);
    };

    function displayItems(db) {
        const transaction = db.transaction(['items'], 'readwrite');
        const objectStore = transaction.objectStore('items');
        const itemsContainer = document.getElementById('items-container');
        const proceedButton = document.getElementById('proceed-to-payment');

        itemsContainer.innerHTML = '<h2>Select Services</h2>';

        const request = objectStore.getAll();

        request.onsuccess = function (event) {
            const items = event.target.result;
            if (items.length === 0) {
                itemsContainer.innerHTML += '<p>No items available.</p>';
                proceedButton.disabled = true;
                return;
            }

            // Initialize items with uploaded property if not present
            items.forEach(item => {
                if (typeof item.uploaded === 'undefined') {
                    item.uploaded = false;
                    objectStore.put(item);
                }
            });

            items.forEach((item, index) => {
                const div = document.createElement('div');
                div.className = 'checked-item';

                const checkboxId = `checkbox-${item.articleId}-${index}`;
                const formId = `uploadForm-${item.articleId}-${index}`;
                const fileInputId = `fileInput-${item.articleId}-${index}`;
                const messageId = `message-${item.articleId}-${index}`;

                div.innerHTML = `
                    <div>
                        <input type="checkbox" id="${checkboxId}" name="service" value="${item.articleId}" ${item.boxCheck ? 'checked' : ''}>
                        <label for="${checkboxId}">${item.name} ($${item.price.toFixed(2)})</label>
                    </div>
                    ${item.boxCheck ? `
                    <form id="${formId}">
                        <div>
                            <label>Select File Type:</label><br>
                            <input type="radio" id="mp3-${index}" name="fileType-${index}" value="mp3" required>
                            <label for="mp3-${index}">MP3 (Max 5GB)</label><br>
                            <input type="radio" id="mp4-${index}" name="fileType-${index}" value="mp4">
                            <label for="mp4-${index}">MP4 (Max 7GB)</label>
                        </div>
                        <br>
                        <div>
                            <label for="${fileInputId}">Choose File:</label>
                            <input type="file" id="${fileInputId}" name="file" accept=".mp3,.mp4" required>
                        </div>
                        <br>
                        <button type="submit">Upload</button>
                    </form>
                    <div id="${messageId}">${item.uploaded ? 'File uploaded successfully!' : ''}</div>
                    ` : ''}
                `;

                itemsContainer.appendChild(div);

                // Checkbox event listener to update boxCheck
                const checkbox = document.getElementById(checkboxId);
                checkbox.addEventListener('change', function () {
                    const articleId = this.value;
                    const isChecked = this.checked;

                    const updateTransaction = db.transaction(['items'], 'readwrite');
                    const updateStore = updateTransaction.objectStore('items');
                    const getItemRequest = updateStore.get(articleId);

                    getItemRequest.onsuccess = function () {
                        const item = getItemRequest.result;
                        if (item) {
                            item.boxCheck = isChecked;
                            if (!isChecked) {
                                item.uploaded = false; // Reset uploaded status if unchecked
                            }
                            const updateRequest = updateStore.put(item);

                            updateRequest.onsuccess = function () {
                                console.log(`Updated boxCheck for ${item.name} to ${isChecked}`);
                                // Refresh display to show/hide upload form
                                displayItems(db);
                            };

                            updateRequest.onerror = function () {
                                console.error('Error updating item:', updateRequest.error);
                            };
                        }
                    };

                    getItemRequest.onerror = function () {
                        console.error('Error retrieving item:', getItemRequest.error);
                    };
                });

                // Upload form event listener
                if (item.boxCheck) {
                    document.getElementById(formId).addEventListener('submit', async function(event) {
                        event.preventDefault();

                        const messageDiv = document.getElementById(messageId);
                        messageDiv.textContent = '';

                        const fileType = document.querySelector(`input[name="fileType-${index}"]:checked`)?.value;
                        if (!fileType) {
                            messageDiv.textContent = 'Please select a file type (MP3 or MP4).';
                            messageDiv.className = 'error';
                            return;
                        }

                        const fileInput = document.getElementById(fileInputId);
                        const file = fileInput.files[0];
                        if (!file) {
                            messageDiv.textContent = 'Please select a file.';
                            messageDiv.className = 'error';
                            return;
                        }

                        const fileExt = file.name.split('.').pop().toLowerCase();
                        if (fileType === 'mp3' && fileExt !== 'mp3') {
                            messageDiv.textContent = 'Selected file must be an MP3.';
                            messageDiv.className = 'error';
                            return;
                        }
                        if (fileType === 'mp4' && fileExt !== 'mp4') {
                            messageDiv.textContent = 'Selected file must be an MP4.';
                            messageDiv.className = 'error';
                            return;
                        }

                        const maxSizeMp3 = 5 * 1024 * 1024 * 1024;
                        const maxSizeMp4 = 7 * 1024 * 1024 * 1024;
                        const maxSize = fileType === 'mp3' ? maxSizeMp3 : maxSizeMp4;

                        if (file.size > maxSize) {
                            const maxGb = fileType === 'mp3' ? '5GB' : '7GB';
                            messageDiv.textContent = `File size exceeds ${maxGb} limit. Your file is ${(file.size / (1024 * 1024 * 1024)).toFixed(2)}GB.`;
                            messageDiv.className = 'error';
                            return;
                        }

                        const formData = new FormData();
                        formData.append('file', file);
                        formData.append('fileType', fileType);

                        try {
                            const response = await fetch('/upload', {
                                method: 'POST',
                                body: formData
                            });

                            if (!response.ok) {
                                const errorData = await response.json();
                                throw new Error(errorData.error || 'Upload failed');
                            }

                            const result = await response.json();
                            messageDiv.textContent = result.message;
                            messageDiv.className = 'success';

                            // Update uploaded status in IndexedDB
                            const updateTransaction = db.transaction(['items'], 'readwrite');
                            const updateStore = updateTransaction.objectStore('items');
                            const getItemRequest = updateStore.get(item.articleId);

                            getItemRequest.onsuccess = function () {
                                const item = getItemRequest.result;
                                if (item) {
                                    item.uploaded = true;
                                    const updateRequest = updateStore.put(item);

                                    updateRequest.onsuccess = function () {
                                        console.log(`Updated uploaded status for ${item.name} to true`);
                                        // Check if any selected items are uploaded
                                        checkUploadStatus(db);
                                    };

                                    updateRequest.onerror = function () {
                                        console.error('Error updating item:', updateRequest.error);
                                    };
                                }
                            };

                            getItemRequest.onerror = function () {
                                console.error('Error retrieving item:', getItemRequest.error);
                            };
                        } catch (error) {
                            messageDiv.textContent = `Error: ${error.message}`;
                            messageDiv.className = 'error';
                        }
                    });
                }
            });

            // Initial check for uploaded items
            checkUploadStatus(db);
        };

        request.onerror = function (event) {
            console.error('Retrieval error:', event.target.errorCode);
        };
    }

    function checkUploadStatus(db) {
        const transaction = db.transaction(['items'], 'readonly');
        const objectStore = transaction.objectStore('items');
        const request = objectStore.getAll();
        const proceedButton = document.getElementById('proceed-to-payment');

        request.onsuccess = function (event) {
            const items = event.target.result;
            const hasUploaded = items.some(item => item.boxCheck && item.uploaded);
            proceedButton.disabled = !hasUploaded;
        };

        request.onerror = function (event) {
            console.error('Error checking upload status:', event.target.errorCode);
        };
    }

    // Proceed to payment button event listener
    document.getElementById('proceed-to-payment').addEventListener('click', function () {
        window.location.href = '/payment.html';
    });
});