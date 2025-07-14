// New code to delete IndexedDB on tab close
window.addEventListener('beforeunload', () => {
    try {
        const deleteRequest = indexedDB.deleteDatabase('ItemsDB');
        deleteRequest.onsuccess = () => {
            console.log('IndexedDB database "ItemsDB" deleted successfully');
        };
        deleteRequest.onerror = (event) => {
            console.error('Error deleting IndexedDB database:', event.target.error);
        };
        deleteRequest.onblocked = () => {
            console.warn('Database deletion blocked; ensure all connections are closed');
        };
    } catch (error) {
        console.error('Failed to initiate database deletion:', error);
    }
});