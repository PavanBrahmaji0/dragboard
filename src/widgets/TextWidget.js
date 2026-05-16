const TextWidget = {
  type: 'text',
  label: 'Notes',
  icon: '📝',
  description: 'Free-form text / notes',
  defaultConfig: {
    title: 'Notes',
    w: 3,
    h: 3,
    bgColor: '#fffde7',
    content: 'Start typing your notes here...',
  },
  configFields: [
    { name: 'content', label: 'Initial content', type: 'textarea' },
  ],

  render(container, config) {
    container.innerHTML = '';
    const ta = document.createElement('textarea');
    ta.className = 'db-text-widget';
    ta.value = config.content || '';
    ta.placeholder = 'Type your notes here...';
    ta.addEventListener('input', () => { config.content = ta.value; });
    container.appendChild(ta);
  },

  update(container, config) {
    const ta = container.querySelector('.db-text-widget');
    if (ta) ta.value = config.content || '';
  },
};

export default TextWidget;
