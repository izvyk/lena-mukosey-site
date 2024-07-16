document.addEventListener('DOMContentLoaded', _ => 
    document.querySelectorAll('.card .imageContainer img').forEach(
        img => img.complete ?
            img.style.opacity = 1 : img.addEventListener('load', _ => img.style.opacity = 1, {once: true})
    )
);