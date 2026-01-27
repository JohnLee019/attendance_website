export function getTodayDate() {
    const date = document.getElementById("date");
    if (!date) return;
    
    const today: Date = new Date();
    const year: number = today.getFullYear();
    const month: string = (today.getMonth()+1).toString().padStart(2, '0');
    const day: string = today.getDate().toString().padStart(2, '0');
    date.textContent = `${month}/${day}/${year}`;
}

window.addEventListener("DOMContentLoaded", () => {
    getTodayDate();
});