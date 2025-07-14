document.addEventListener('DOMContentLoaded', function () {
    // Carousel Logic
    let nextDom = document.getElementById('next');
    let prevDom = document.getElementById('prev');
    let carouselDom = document.querySelector('.carousel');
    let SliderDom = carouselDom.querySelector('.carousel .list');
    let thumbnailBorderDom = document.querySelector('.carousel .thumbnail');
    let thumbnailItemsDom = thumbnailBorderDom.querySelectorAll('.item');
    let timeDom = document.querySelector('.carousel .time');

    thumbnailBorderDom.appendChild(thumbnailItemsDom[0]);
    let timeRunning = 4000;
    let timeAutoNext = 8000;

    nextDom.onclick = function() {
        showSlider('next');
    }

    prevDom.onclick = function() {
        showSlider('prev');
    }

    let runTimeOut;
    let runNextAuto = setTimeout(() => {
        nextDom.click();
    }, timeAutoNext);

    function showSlider(type) {
        let SliderItemsDom = SliderDom.querySelectorAll('.carousel .list .item');
        let thumbnailItemsDom = document.querySelectorAll('.carousel .thumbnail .item');

        if (type === 'next') {
            SliderDom.appendChild(SliderItemsDom[0]);
            thumbnailBorderDom.appendChild(thumbnailItemsDom[0]);
            carouselDom.classList.add('next');
        } else {
            SliderDom.prepend(SliderItemsDom[SliderItemsDom.length - 1]);
            thumbnailBorderDom.prepend(thumbnailItemsDom[thumbnailItemsDom.length - 1]);
            carouselDom.classList.add('prev');
        }
        clearTimeout(runTimeOut);
        runTimeOut = setTimeout(() => {
            carouselDom.classList.remove('next');
            carouselDom.classList.remove('prev');
        }, timeRunning);

        clearTimeout(runNextAuto);
        runNextAuto = setTimeout(() => {
            nextDom.click();
        }, timeAutoNext);
    }

    // IndexedDB Logic
    const request = indexedDB.open('ItemsDB', 4);

    request.onupgradeneeded = function (event) {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('items')) {
            db.createObjectStore('items', { keyPath: 'articleId' });
        }
        console.log('Database setup complete');
    };

    request.onsuccess = function (event) {
        const db = event.target.result;
        console.log('Database opened successfully');

        fetch('/api/items')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch items');
                }
                return response.json();
            })
            .then(data => {
                const transaction = db.transaction(['items'], 'readwrite');
                const objectStore = transaction.objectStore('items');

                data.forEach(item => {
                    // Ensure uploaded property is included
                    item.uploaded = item.uploaded || false;
                    objectStore.put(item);
                });

                transaction.oncomplete = function () {
                    console.log('Items stored in IndexedDB');
                };

                transaction.onerror = function () {
                    console.error('Transaction failed');
                };
            })
            .catch(error => console.error('Fetch error:', error));
    };

    request.onerror = function (event) {
        console.error('Database error:', event.target.errorCode);
    };
});