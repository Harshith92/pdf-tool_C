document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.tabs button');
    const sections = document.querySelectorAll('main section');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons
            tabButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to the clicked button
            button.classList.add('active');

            // Hide all sections
            sections.forEach(sec => sec.classList.add('hidden'));

            // Show target section
            const targetId = 'section-' + button.getAttribute('data-tab');
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.remove('hidden');
            }
        });
    });
});
