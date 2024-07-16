document.addEventListener('DOMContentLoaded', _ => 
    document.querySelectorAll('.card .imageContainer img').forEach(
        img => img.addEventListener('load', _ => img.style.opacity = 1)
    )
);