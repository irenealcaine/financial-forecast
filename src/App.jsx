import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, TrendingUp, TrendingDown, Download, Upload } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

// Utilidades para cálculos
const getDaysInYear = (year) => {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0) ? 366 : 365;
};

const getDaysInMonth = (year, month) => {
  return new Date(year, month, 0).getDate();
};

const getAdjustedDay = (year, month, day) => {
  const maxDay = getDaysInMonth(year, month);
  return Math.min(day, maxDay);
};

const dateToDay = (year, date) => {
  const start = new Date(year, 0, 1);
  const current = new Date(date);
  return Math.floor((current - start) / (1000 * 60 * 60 * 24)) + 1;
};

const dayToDate = (year, day) => {
  const date = new Date(year, 0, 1);
  date.setDate(day);
  return date;
};

// Componente Modal
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md mx-4 border border-gray-800">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={24} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

// Componente Principal
const FinancialForecast = () => {
  const [year, setYear] = useState(2025);
  const [initialBalance, setInitialBalance] = useState(1000);
  const [monthlyRules, setMonthlyRules] = useState([]);
  const [plannedEvents, setPlannedEvents] = useState([]);
  const [realMovements, setRealMovements] = useState([]);

  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editingMovement, setEditingMovement] = useState(null);

  // Funciones de exportación e importación
  const exportData = () => {
    const data = {
      year,
      initialBalance,
      monthlyRules,
      plannedEvents,
      realMovements
    };

    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finanzas-${year}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importData = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.year) setYear(data.year);
        if (data.initialBalance !== undefined) setInitialBalance(data.initialBalance);
        if (data.monthlyRules) setMonthlyRules(data.monthlyRules);
        if (data.plannedEvents) setPlannedEvents(data.plannedEvents);
        if (data.realMovements) setRealMovements(data.realMovements);
        alert('Datos importados correctamente');
      } catch (error) {
        alert('Error al importar los datos. Verifica que el archivo sea correcto.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Cargar datos desde localStorage
  useEffect(() => {
    const saved = localStorage.getItem('financialData');
    if (saved) {
      const data = JSON.parse(saved);
      setYear(data.year || 2025);
      setInitialBalance(data.initialBalance || 1000);
      setMonthlyRules(data.monthlyRules || []);
      setPlannedEvents(data.plannedEvents || []);
      setRealMovements(data.realMovements || []);
    }
  }, []);

  // Guardar datos en localStorage
  useEffect(() => {
    const data = {
      year,
      initialBalance,
      monthlyRules,
      plannedEvents,
      realMovements
    };
    localStorage.setItem('financialData', JSON.stringify(data));
  }, [year, initialBalance, monthlyRules, plannedEvents, realMovements]);

  // Calcular línea prevista
  const forecastLine = useMemo(() => {
    const days = getDaysInYear(year);
    const line = Array(days).fill(0).map((_, i) => ({ day: i + 1, balance: 0 }));

    let balance = initialBalance;

    for (let day = 1; day <= days; day++) {
      const date = dayToDate(year, day);
      const month = date.getMonth() + 1;
      const dayOfMonth = date.getDate();

      // Aplicar reglas mensuales activas
      monthlyRules.forEach(rule => {
        const ruleStartDate = new Date(rule.activeFrom);
        if (date >= ruleStartDate) {
          const adjustedDay = getAdjustedDay(year, month, rule.dayOfMonth);
          if (dayOfMonth === adjustedDay) {
            balance += rule.amount;
          }
        }
      });

      // Aplicar eventos previstos
      plannedEvents.forEach(event => {
        const eventDate = new Date(event.date);
        if (eventDate.getFullYear() === year &&
          eventDate.getMonth() === date.getMonth() &&
          eventDate.getDate() === date.getDate()) {
          balance += event.amount;
        }
      });

      line[day - 1].balance = balance;
    }

    return line;
  }, [year, initialBalance, monthlyRules, plannedEvents]);

  // Calcular línea real
  const realLine = useMemo(() => {
    return forecastLine.map((point, i) => {
      let adjustment = 0;
      const date = dayToDate(year, point.day);

      realMovements.forEach(movement => {
        const movDate = new Date(movement.date);
        if (movDate <= date && movDate.getFullYear() === year) {
          adjustment += movement.amount;
        }
      });

      return {
        day: point.day,
        forecast: point.balance,
        real: point.balance + adjustment
      };
    });
  }, [forecastLine, realMovements, year]);

  // Día actual
  const today = new Date();
  const currentDay = today.getFullYear() === year ? dateToDay(year, today) : null;
  const currentDifference = currentDay ? realLine[currentDay - 1].real - realLine[currentDay - 1].forecast : 0;

  // Datos para la gráfica (muestreo cada 2 días para mejor precisión)
  const chartData = realLine.filter((_, i) => i % 2 === 0 || i === realLine.length - 1).map(point => ({
    ...point,
    date: dayToDate(year, point.day).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
  }));

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-start mb-4">
            <h1 className="text-2xl font-bold">Previsión Financiera {year}</h1>
            <div className="flex gap-2">
              <button
                onClick={exportData}
                className="bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded flex items-center gap-2 text-sm"
                title="Exportar datos"
              >
                <Download size={16} />
                Exportar
              </button>
              <label className="bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded flex items-center gap-2 text-sm cursor-pointer">
                <Upload size={16} />
                Importar
                <input
                  type="file"
                  accept=".json"
                  onChange={importData}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="flex gap-4 items-center mb-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Año</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="bg-gray-900 border border-gray-800 rounded px-3 py-2 w-24"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Saldo Inicial (1 Ene)</label>
              <input
                type="number"
                value={initialBalance}
                onChange={(e) => setInitialBalance(parseFloat(e.target.value))}
                className="bg-gray-900 border border-gray-800 rounded px-3 py-2 w-32"
              />
            </div>
          </div>

          {currentDay && (
            <div className="text-sm">
              <span className="text-gray-500">Diferencia actual: </span>
              <span className={currentDifference >= 0 ? 'text-purple-400' : 'text-pink-400'}>
                {currentDifference >= 0 ? '+' : ''}{currentDifference.toFixed(2)} €
              </span>
            </div>
          )}
        </div>

        {/* Botones de acción */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setShowRuleModal(true)}
            className="bg-purple-900 hover:bg-purple-800 px-4 py-2 rounded flex items-center gap-2"
          >
            <Plus size={16} />
            Regla Mensual
          </button>
          <button
            onClick={() => setShowEventModal(true)}
            className="bg-purple-900 hover:bg-purple-800 px-4 py-2 rounded flex items-center gap-2"
          >
            <Plus size={16} />
            Evento Previsto
          </button>
          <button
            onClick={() => setShowMovementModal(true)}
            className="bg-purple-900 hover:bg-purple-800 px-4 py-2 rounded flex items-center gap-2"
          >
            <Plus size={16} />
            Movimiento Real
          </button>
        </div>

        {/* Gráfica */}
        <div className="bg-gray-900 rounded-lg p-2 sm:p-4 mb-6">
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" opacity={0.3} />
              <XAxis
                dataKey="date"
                stroke="#6B7280"
                tick={{ fill: '#6B7280', fontSize: 11 }}
              />
              <YAxis
                stroke="#6B7280"
                tick={{ fill: '#6B7280', fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', border: '1px solid #1F2937', borderRadius: '6px' }}
                labelStyle={{ color: '#9CA3AF' }}
              />
              {currentDay && <ReferenceLine x={currentDay} stroke="#8B5CF6" strokeWidth={2} />}
              <Line
                type="monotone"
                dataKey="forecast"
                stroke="#7C3AED"
                strokeWidth={1.5}
                dot={false}
                name="Previsto"
              />
              <Line
                type="monotone"
                dataKey="real"
                stroke="#A78BFA"
                strokeWidth={1.5}
                dot={false}
                name="Real"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Listas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Reglas mensuales */}
          <div className="bg-gray-900 rounded-lg p-4">
            <h3 className="font-semibold mb-3">Reglas Mensuales</h3>
            <div className="space-y-2">
              {monthlyRules.map((rule, i) => (
                <div key={i} className="flex justify-between items-center text-sm bg-gray-800 p-2 rounded">
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => {
                      setEditingRule({ index: i, data: rule });
                      setShowRuleModal(true);
                    }}
                  >
                    {rule.title && <div className="text-white text-sm font-medium">{rule.title}</div>}
                    <div className={rule.amount >= 0 ? 'text-purple-400' : 'text-pink-400'}>
                      {rule.amount >= 0 ? '+' : ''}{rule.amount} €
                    </div>
                    <div className="text-gray-500 text-xs">
                      Día {rule.dayOfMonth} (desde {new Date(rule.activeFrom).toLocaleDateString()})
                    </div>
                  </div>
                  <button
                    onClick={() => setMonthlyRules(monthlyRules.filter((_, idx) => idx !== i))}
                    className="text-gray-500 hover:text-pink-400"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Eventos previstos */}
          <div className="bg-gray-900 rounded-lg p-4">
            <h3 className="font-semibold mb-3">Eventos Previstos</h3>
            <div className="space-y-2">
              {plannedEvents.map((event, i) => (
                <div key={i} className="flex justify-between items-center text-sm bg-gray-800 p-2 rounded">
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => {
                      setEditingEvent({ index: i, data: event });
                      setShowEventModal(true);
                    }}
                  >
                    {event.title && <div className="text-white text-sm font-medium">{event.title}</div>}
                    <div className={event.amount >= 0 ? 'text-purple-400' : 'text-pink-400'}>
                      {event.amount >= 0 ? '+' : ''}{event.amount} €
                    </div>
                    <div className="text-gray-500 text-xs">
                      {new Date(event.date).toLocaleDateString()}
                      {event.description && ` - ${event.description}`}
                    </div>
                  </div>
                  <button
                    onClick={() => setPlannedEvents(plannedEvents.filter((_, idx) => idx !== i))}
                    className="text-gray-500 hover:text-pink-400"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Movimientos reales */}
          <div className="bg-gray-900 rounded-lg p-4">
            <h3 className="font-semibold mb-3">Movimientos Reales</h3>
            <div className="space-y-2">
              {realMovements.map((mov, i) => (
                <div key={i} className="flex justify-between items-center text-sm bg-gray-800 p-2 rounded">
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => {
                      setEditingMovement({ index: i, data: mov });
                      setShowMovementModal(true);
                    }}
                  >
                    {mov.title && <div className="text-white text-sm font-medium">{mov.title}</div>}
                    <div className={mov.amount >= 0 ? 'text-purple-400' : 'text-pink-400'}>
                      {mov.amount >= 0 ? '+' : ''}{mov.amount} €
                    </div>
                    <div className="text-gray-500 text-xs">
                      {new Date(mov.date).toLocaleDateString()}
                      {mov.note && ` - ${mov.note}`}
                    </div>
                  </div>
                  <button
                    onClick={() => setRealMovements(realMovements.filter((_, idx) => idx !== i))}
                    className="text-gray-500 hover:text-pink-400"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modales */}
      <RuleModal
        isOpen={showRuleModal}
        onClose={() => {
          setShowRuleModal(false);
          setEditingRule(null);
        }}
        onSave={(rule) => {
          if (editingRule !== null) {
            const updated = [...monthlyRules];
            updated[editingRule.index] = rule;
            setMonthlyRules(updated);
          } else {
            setMonthlyRules([...monthlyRules, rule]);
          }
          setShowRuleModal(false);
          setEditingRule(null);
        }}
        editData={editingRule?.data}
      />

      <EventModal
        isOpen={showEventModal}
        onClose={() => {
          setShowEventModal(false);
          setEditingEvent(null);
        }}
        onSave={(event) => {
          if (editingEvent !== null) {
            const updated = [...plannedEvents];
            updated[editingEvent.index] = event;
            setPlannedEvents(updated);
          } else {
            setPlannedEvents([...plannedEvents, event]);
          }
          setShowEventModal(false);
          setEditingEvent(null);
        }}
        year={year}
        editData={editingEvent?.data}
      />

      <MovementModal
        isOpen={showMovementModal}
        onClose={() => {
          setShowMovementModal(false);
          setEditingMovement(null);
        }}
        onSave={(movement) => {
          if (editingMovement !== null) {
            const updated = [...realMovements];
            updated[editingMovement.index] = movement;
            setRealMovements(updated);
          } else {
            setRealMovements([...realMovements, movement]);
          }
          setShowMovementModal(false);
          setEditingMovement(null);
        }}
        year={year}
        editData={editingMovement?.data}
      />
    </div>
  );
};

// Modal para reglas mensuales
const RuleModal = ({ isOpen, onClose, onSave, editData }) => {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [activeFrom, setActiveFrom] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (editData) {
      setTitle(editData.title || '');
      setAmount(editData.amount.toString());
      setDayOfMonth(editData.dayOfMonth.toString());
      setActiveFrom(editData.activeFrom);
    } else {
      setTitle('');
      setAmount('');
      setDayOfMonth('1');
      setActiveFrom(new Date().toISOString().split('T')[0]);
    }
  }, [editData, isOpen]);

  const handleSave = () => {
    if (amount && dayOfMonth && activeFrom) {
      onSave({
        title,
        amount: parseFloat(amount),
        dayOfMonth: parseInt(dayOfMonth),
        activeFrom
      });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editData ? "Editar Regla Mensual" : "Nueva Regla Mensual"}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Título (opcional)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Nómina, Alquiler..."
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">Cantidad (€)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Positivo: ingreso, Negativo: gasto"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">Día del mes (1-31)</label>
          <input
            type="number"
            min="1"
            max="31"
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">Activa desde</label>
          <input
            type="date"
            value={activeFrom}
            onChange={(e) => setActiveFrom(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
          />
        </div>
        <button
          onClick={handleSave}
          className="w-full bg-purple-900 hover:bg-purple-800 py-2 rounded"
        >
          {editData ? "Actualizar" : "Guardar"}
        </button>
      </div>
    </Modal>
  );
};

// Modal para eventos previstos
const EventModal = ({ isOpen, onClose, onSave, year, editData }) => {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(`${year}-01-01`);
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (editData) {
      setTitle(editData.title || '');
      setAmount(editData.amount.toString());
      setDate(editData.date);
      setDescription(editData.description || '');
    } else {
      setTitle('');
      setAmount('');
      setDate(`${year}-01-01`);
      setDescription('');
    }
  }, [editData, isOpen, year]);

  const handleSave = () => {
    if (amount && date) {
      onSave({
        title,
        amount: parseFloat(amount),
        date,
        description
      });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editData ? "Editar Evento Previsto" : "Nuevo Evento Previsto"}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Título (opcional)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Seguro anual, Vacaciones..."
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">Cantidad (€)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">Fecha</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">Descripción (opcional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
          />
        </div>
        <button
          onClick={handleSave}
          className="w-full bg-purple-900 hover:bg-purple-800 py-2 rounded"
        >
          {editData ? "Actualizar" : "Guardar"}
        </button>
      </div>
    </Modal>
  );
};

// Modal para movimientos reales
const MovementModal = ({ isOpen, onClose, onSave, year, editData }) => {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (editData) {
      setTitle(editData.title || '');
      setAmount(editData.amount.toString());
      setDate(editData.date);
      setNote(editData.note || '');
    } else {
      setTitle('');
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);
      setNote('');
    }
  }, [editData, isOpen]);

  const handleSave = () => {
    if (amount && date) {
      onSave({
        title,
        amount: parseFloat(amount),
        date,
        note
      });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editData ? "Editar Movimiento Real" : "Nuevo Movimiento Real"}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Título (opcional)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Gasto imprevisto, Pago extra..."
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">Cantidad (€)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">Fecha</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">Nota (opcional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
          />
        </div>
        <button
          onClick={handleSave}
          className="w-full bg-purple-900 hover:bg-purple-800 py-2 rounded"
        >
          {editData ? "Actualizar" : "Guardar"}
        </button>
      </div>
    </Modal>
  );
};

export default FinancialForecast;
