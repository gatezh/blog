---
title: "Contact"
date: 2025-11-14
showToc: false
---

<style>
.contact-form {
  max-width: 600px;
  margin: 2rem auto;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background-color: var(--entry);
  color: var(--primary);
  font-family: inherit;
  font-size: 1rem;
}

.form-group textarea {
  min-height: 150px;
  resize: vertical;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--tertiary);
}

.submit-btn {
  background-color: var(--tertiary);
  color: var(--primary);
  padding: 0.75rem 2rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: opacity 0.2s;
}

.submit-btn:hover {
  opacity: 0.8;
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-message {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 4px;
  display: none;
}

.form-message.success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.form-message.error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.form-message.show {
  display: block;
}
</style>

<div class="contact-form">
  <p>Feel free to reach out to me using the form below:</p>

  <form id="contactForm">
    <div class="form-group">
      <label for="name">Name *</label>
      <input type="text" id="name" name="name" required>
    </div>

    <div class="form-group">
      <label for="email">Email *</label>
      <input type="email" id="email" name="email" required>
    </div>

    <div class="form-group">
      <label for="subject">Subject *</label>
      <input type="text" id="subject" name="subject" required>
    </div>

    <div class="form-group">
      <label for="message">Message *</label>
      <textarea id="message" name="message" required></textarea>
    </div>

    <button type="submit" class="submit-btn" id="submitBtn">Send Message</button>

    <div id="formMessage" class="form-message"></div>
  </form>
</div>

<script>
document.getElementById('contactForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const submitBtn = document.getElementById('submitBtn');
  const formMessage = document.getElementById('formMessage');
  const form = e.target;

  // Disable submit button
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';

  // Hide previous messages
  formMessage.classList.remove('show', 'success', 'error');

  const formData = {
    name: form.name.value,
    email: form.email.value,
    subject: form.subject.value,
    message: form.message.value
  };

  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData)
    });

    const data = await response.json();

    if (response.ok) {
      formMessage.textContent = 'Thank you! Your message has been sent successfully.';
      formMessage.classList.add('success', 'show');
      form.reset();
    } else {
      throw new Error(data.error || 'Failed to send message');
    }
  } catch (error) {
    formMessage.textContent = 'Sorry, there was an error sending your message. Please try again later.';
    formMessage.classList.add('error', 'show');
    console.error('Form submission error:', error);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send Message';
  }
});
</script>
