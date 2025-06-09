const toggleBtn = document.getElementById("toggleSidebarBtn");
    const sidebar = document.getElementById("sidebar");
    const body = document.body;

    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("active");
      body.classList.toggle("sidebar-open");
    });

    document.getElementById('signinBtn').onclick = function() {
    document.getElementById('signinPopup').style.display = 'block';
};

document.getElementById('signupBtn').onclick = function() {
    document.getElementById('signupPopup').style.display = 'block';
};

document.getElementById('closeSignin').onclick = function() {
    document.getElementById('signinPopup').style.display = 'none';
};

document.getElementById('closeSignup').onclick = function() {
    document.getElementById('signupPopup').style.display = 'none';
};

// Handle Sign In
document.getElementById('signinForm').onsubmit = function(event) {
    event.preventDefault();
    const username = this[0].value;
    const password = this[1].value;

    fetch('http://localhost:3000/signin', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            alert(data.message);
            if (data.user) {
                // Redirect or perform actions after successful sign-in
                console.log('User :', data.user);
            }
        }
    })
    .catch(error => console.error('Error:', error));
};

// Handle Sign Up
document.getElementById('signupForm').onsubmit = function(event) {
    event.preventDefault();
    const username = this[0].value;
    const email = this[1].value;
    const password = this[2].value;

    fetch('http://localhost:3000/signup', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, email, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.id) {
            alert('Sign up successful! User ID: ' + data.id);
            document.getElementById('signupPopup').style.display = 'none';
        }
    })
    .catch(error => console.error('Error:', error));
};

// Close popups when clicking outside of them
window.onclick = function(event) {
    if (event.target == document.getElementById('signinPopup')) {
        document.getElementById('signinPopup').style.display = 'none';
    }
    if (event.target == document.getElementById('signupPopup')) {
        document.getElementById('signupPopup').style.display = 'none';
    }
};


    document.getElementById('viewMoreBtn').addEventListener('click', function() {
  const hiddenItems = document.querySelectorAll('.gallery-item.hidden');
  hiddenItems.forEach(item => {
    item.classList.remove('hidden'); 
  });
  this.style.display = 'none'; 
});
