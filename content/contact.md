---
title: "Contact"
date: 2025-11-14
showToc: false
---

<link rel="stylesheet" href="/css/tailwind.css">

<div class="max-w-2xl mx-auto px-4 py-8">
  <p class="mb-8 text-lg text-secondary">Feel free to reach out to me using the form below:</p>

  <form id="contactForm" class="space-y-6">
    <div>
      <label for="name" class="form-label">Name *</label>
      <input
        type="text"
        id="name"
        name="name"
        required
        class="form-input"
        placeholder="Your name"
      >
    </div>

    <div>
      <label for="email" class="form-label">Email *</label>
      <input
        type="email"
        id="email"
        name="email"
        required
        class="form-input"
        placeholder="your.email@example.com"
      >
    </div>

    <div>
      <label for="subject" class="form-label">Subject *</label>
      <input
        type="text"
        id="subject"
        name="subject"
        required
        class="form-input"
        placeholder="What is this about?"
      >
    </div>

    <div>
      <label for="message" class="form-label">Message *</label>
      <textarea
        id="message"
        name="message"
        required
        class="form-textarea"
        placeholder="Your message..."
      ></textarea>
    </div>

    <button type="submit" class="btn-primary" id="submitBtn">
      Send Message
    </button>

    <div
      id="formMessage"
      class="hidden mt-4 p-4 rounded-lg"
      role="alert"
    ></div>
  </form>
</div>

<script>
const WORKER_URL = 'https://contact.gatezh.com'; // Update this with your worker URL after deployment

document.getElementById('contactForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const submitBtn = document.getElementById('submitBtn');
  const formMessage = document.getElementById('formMessage');
  const form = e.target;

  // Disable submit button
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';

  // Hide previous messages
  formMessage.className = 'hidden mt-4 p-4 rounded-lg';

  const formData = {
    name: form.name.value.trim(),
    email: form.email.value.trim(),
    subject: form.subject.value.trim(),
    message: form.message.value.trim()
  };

  try {
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData)
    });

    const data = await response.json();

    if (response.ok) {
      formMessage.textContent = 'Thank you! Your message has been sent successfully.';
      formMessage.className = 'block mt-4 p-4 rounded-lg bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 border border-green-200 dark:border-green-800';
      form.reset();
    } else {
      throw new Error(data.error || 'Failed to send message');
    }
  } catch (error) {
    formMessage.textContent = 'Sorry, there was an error sending your message. Please try again later.';
    formMessage.className = 'block mt-4 p-4 rounded-lg bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100 border border-red-200 dark:border-red-800';
    console.error('Form submission error:', error);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send Message';
  }
});
</script>
