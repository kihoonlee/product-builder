const form = document.getElementById('affiliate-form');
const submitBtn = document.getElementById('submit-btn');
const btnText = document.getElementById('btn-text');
const btnSpinner = document.getElementById('btn-spinner');
const successMsg = document.getElementById('success-msg');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  submitBtn.disabled = true;
  btnText.textContent = '전송 중...';
  btnSpinner.classList.remove('hidden');

  const data = new FormData(form);

  try {
    const res = await fetch(form.action, {
      method: 'POST',
      body: data,
      headers: { Accept: 'application/json' },
    });

    if (res.ok) {
      form.classList.add('hidden');
      successMsg.classList.remove('hidden');
    } else {
      const json = await res.json();
      const msg = json.errors?.map(e => e.message).join(', ') || '오류가 발생했습니다. 다시 시도해 주세요.';
      alert(msg);
      resetButton();
    }
  } catch {
    alert('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    resetButton();
  }
});

function resetButton() {
  submitBtn.disabled = false;
  btnText.textContent = '문의 보내기';
  btnSpinner.classList.add('hidden');
}
