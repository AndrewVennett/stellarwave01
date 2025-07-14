document.addEventListener('DOMContentLoaded', function () {
  var stripe = Stripe('pk_test_51QkE43C1UqQhFhw44FBwsaPxexyTd3KbAAdIkEf1eWCsBtdKk4FTQ04JQil8zGQ3BMkFTsIW34zpO4ICVGeXOdgm001REg2tXE');
  var elements = stripe.elements();

  var style = {
    base: {
      fontSize: '16px',
      color: '#fff',
      fontFamily: '"Poppins", sans-serif',
      '::placeholder': { color: 'rgba(255, 255, 255, 0.7)' }
    },
    invalid: { color: '#fa755a' }
  };

  var cardNumber = elements.create('cardNumber', { style: style });
  cardNumber.mount('#cardNumber');

  var cardExpiry = elements.create('cardExpiry', { style: style });
  cardExpiry.mount('#expDate');

  var cardCvc = elements.create('cardCvc', { style: style });
  cardCvc.mount('#CVC');

  let cardNumberFilled = false;
  let expDateFilled = false;
  let cvcFilled = false;

  function updateFlipState() {
    const cardName = document.getElementById('cardName').value.trim();
    const container = document.querySelector('.container');
    const frontFieldsFilled = cardNumberFilled && cardName !== '' && expDateFilled;

    console.log('updateFlipState:', { cardNumberFilled, cardName, expDateFilled, cvcFilled, frontFieldsFilled });

    if (frontFieldsFilled && !cvcFilled && !container.classList.contains('flipped')) {
      console.log('Adding flipped class');
      container.classList.add('flipped');
    } else if (frontFieldsFilled && cvcFilled && container.classList.contains('flipped')) {
      console.log('Removing flipped class (CVC filled)');
      container.classList.remove('flipped');
    } else if (!frontFieldsFilled && container.classList.contains('flipped')) {
      console.log('Removing flipped class (front fields incomplete)');
      container.classList.remove('flipped');
    }
  }

  cardNumber.on('change', (event) => {
    cardNumberFilled = event.complete;
    document.getElementById('card-errors').textContent = event.error ? event.error.message : '';
    console.log('cardNumber change:', event);
    updateFlipState();
  });

  cardExpiry.on('change', (event) => {
    expDateFilled = event.complete;
    document.getElementById('card-errors').textContent = event.error ? event.error.message : '';
    console.log('cardExpiry change:', event);
    updateFlipState();
  });

  cardCvc.on('change', (event) => {
    cvcFilled = event.complete;
    document.getElementById('card-errors').textContent = event.error ? event.error.message : '';
    console.log('cardCvc change:', event);
    updateFlipState();
  });

  document.getElementById('cardName').addEventListener('input', () => {
    console.log('cardName input:', document.getElementById('cardName').value);
    updateFlipState();
  });

  // IndexedDB Logic for Payment Page
  const request = indexedDB.open('ItemsDB', 4);

  request.onsuccess = function (event) {
    const db = event.target.result;
    const transaction = db.transaction(['items'], 'readonly');
    const objectStore = transaction.objectStore('items');
    const summaryBody = document.getElementById('summary-body');
    const totalAmountElement = document.getElementById('total-amount');

    summaryBody.innerHTML = '';

    const getRequest = objectStore.getAll();

    getRequest.onsuccess = function () {
      const items = getRequest.result;
      let total = 0;

      const selectedItems = items.filter(item => item.boxCheck && item.uploaded);
      if (selectedItems.length === 0) {
        summaryBody.innerHTML = '<tr><td colspan="2">No services selected or uploaded.</td></tr>';
        totalAmountElement.textContent = '$0.00';
        document.getElementById('payment-form').querySelector('button[type="submit"]').disabled = true;
        return;
      }

      selectedItems.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${item.name}</td>
          <td>$${item.price.toFixed(2)}</td>
        `;
        summaryBody.appendChild(row);
        total += item.price;
      });

      totalAmountElement.textContent = `$${total.toFixed(2)}`;
    };

    getRequest.onerror = function () {
      console.error('Error retrieving items:', getRequest.error);
    };
  };

  request.onerror = function (event) {
    console.error('Database error:', event.target.errorCode);
  };

  // Form submission
  document.getElementById('payment-form').addEventListener('submit', async function(event) {
    event.preventDefault();

    const cardName = document.getElementById('cardName').value.trim();
    const firstNameMatch = cardName.match(/^[^ ]+/);
    const lastNameMatch = cardName.match(/[^ ]+$/);
    const firstName = firstNameMatch ? firstNameMatch[0] : 'Unknown';
    const lastName = lastNameMatch ? lastNameMatch[0] : 'Unknown';

    // Get selected items from IndexedDB
    const dbRequest = indexedDB.open('ItemsDB', 4);
    dbRequest.onsuccess = async function (event) {
      const db = event.target.result;
      const transaction = db.transaction(['items'], 'readonly');
      const objectStore = transaction.objectStore('items');
      const getRequest = objectStore.getAll();

      getRequest.onsuccess = async function () {
        const items = getRequest.result;
        const selectedItems = items.filter(item => item.boxCheck && item.uploaded);
        const selectedArticleIds = selectedItems.map(item => item.articleId);

        if (selectedArticleIds.length === 0) {
          document.getElementById('card-errors').textContent = 'Please select at least one uploaded service to proceed.';
          return;
        }

        // Get total from /api/total
        const totalResponse = await fetch('http://localhost:3000/api/total', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articleIds: JSON.stringify(selectedArticleIds) })
        });

        if (!totalResponse.ok) {
          const errorData = await totalResponse.json();
          document.getElementById('card-errors').textContent = errorData.error || 'Failed to calculate total';
          return;
        }

        const totalData = await totalResponse.json();
        const totalAmount = totalData.totalAmount;

        const { paymentMethod, error } = await stripe.createPaymentMethod({
          type: 'card',
          card: cardNumber,
          billing_details: { name: cardName }
        });

        if (error) {
          document.getElementById('card-errors').textContent = error.message;
        } else {
          try {
            //const response = await fetch('http://localhost:3000/create-payment-intent', {
            //const response = await fetch(`${req.protocol}://${req.get('host')}/create-payment-intent`, {
            const response = await fetch('http://localhost:3000/create-payment-intent', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                paymentMethodId: paymentMethod.id,
                totalAmount: totalAmount,
                firstName: firstName,
                lastName: lastName
              })
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || `Server responded with status: ${response.status}`);
            }

            const data = await response.json();
            if (data.error) {
              document.getElementById('card-errors').textContent = data.error;
            } else {
              window.location.href = data.redirectUrl;
            }
          } catch (fetchError) {
            document.getElementById('card-errors').textContent = `Payment failed: ${fetchError.message}`;
            console.error('Fetch error:', fetchError);
          }
        }
      };

      getRequest.onerror = function () {
        console.error('Error retrieving items:', getRequest.error);
      };
    };

    dbRequest.onerror = function (event) {
      console.error('Database error:', event.target.errorCode);
    };
  });
});