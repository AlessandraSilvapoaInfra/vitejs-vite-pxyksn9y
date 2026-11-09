import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';

interface Turma {
  id: number;
  nome: string;
  turno: string;
  ano_letivo: number;
}

interface Visitante {
  id: number;
  nome_completo: string;
  documento: string;
  telefone?: string;
  empresa_origem?: string;
}

interface RegistroHistorico {
  id: number;
  tipo: string;
  nome: string;
  hora: string;
}

// Interface unificada para listagem (Alunos e Funcionários)
interface PessoaListagem {
  id: number;
  tipo: 'Aluno' | 'Funcionario';
  matricula: string;
  nome_completo: string;
  detalhe: string;
}

export default function App() {
  const [isTablet, setIsTablet] = useState(window.innerWidth < 1024);
  const [visualizacaoManual, setVisualizacaoManual] = useState<
    'auto' | 'notebook' | 'tablet'
  >('auto');
  const buscaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleResize = () => setIsTablet(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);

    if (!modoTabletAtivo && buscaRef.current) {
      buscaRef.current.focus();
    }

    return () => window.removeEventListener('resize', handleResize);
  }, [isTablet, visualizacaoManual]);

  const modoTabletAtivo =
    visualizacaoManual === 'tablet' ||
    (visualizacaoManual === 'auto' && isTablet);

  return (
    <div className="min-h-screen bg-gray-200 p-4 font-sans">
      <header className="mb-6 flex justify-between items-center bg-white p-4 rounded-lg shadow-md border-l-4 border-blue-600">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Controle de Acesso Escolar
          </h1>
          <p className="text-sm text-gray-500">
            Modo de Operação:{' '}
            <span className="font-bold text-blue-600">
              {modoTabletAtivo
                ? 'Touch (Registro Rápido)'
                : 'Teclado (Busca & Visitantes)'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-gray-100 p-1 rounded-lg flex text-xs font-semibold shadow-inner">
            <button
              onClick={() => setVisualizacaoManual('notebook')}
              className={`px-4 py-2 rounded-md transition-all ${
                !modoTabletAtivo
                  ? 'bg-white shadow text-blue-700'
                  : 'text-gray-500 hover:bg-gray-200'
              }`}
            >
              💻 Terminal de Mesa
            </button>
            <button
              onClick={() => setVisualizacaoManual('tablet')}
              className={`px-4 py-2 rounded-md transition-all ${
                modoTabletAtivo
                  ? 'bg-white shadow text-blue-700'
                  : 'text-gray-500 hover:bg-gray-200'
              }`}
            >
              📱 Terminal Touch
            </button>
          </div>

          <div className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-full border border-green-200">
            <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-bold text-green-700">
              Sistema Online
            </span>
          </div>
        </div>
      </header>

      {modoTabletAtivo ? (
        <InterfaceTablet />
      ) : (
        <InterfaceNotebook ref={buscaRef} />
      )}
    </div>
  );
}

// ========================================================
// 💻 TERMINAL DE MESA (ALUNOS, DOCENTES E VISITANTES)
// ========================================================
const InterfaceNotebook = React.forwardRef<HTMLInputElement>((props, ref) => {
  const [modoBusca, setModoBusca] = useState<'Aluno' | 'Funcionario'>('Aluno');
  const [termo, setTermo] = useState('');
  const [sugestoes, setSugestoes] = useState<PessoaListagem[]>([]);
  const [confirmacao, setConfirmacao] = useState<{
    tipo: string;
    nome: string;
    detalhe: string;
    hora: string;
  } | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string>('');

  const [historico, setHistorico] = useState<RegistroHistorico[]>([]);

  const [termoVisitante, setTermoVisitante] = useState('');
  const [visitanteEncontrado, setVisitanteEncontrado] =
    useState<Visitante | null>(null);
  const [buscaVisitanteFeita, setBuscaVisitanteFeita] = useState(false);
  const [novoNomeVisitante, setNovoNomeVisitante] = useState('');
  const [novaEmpresaVisitante, setNovaEmpresaVisitante] = useState('');

  useEffect(() => {
    const buscarPessoas = async () => {
      const textoLimpo = termo
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      if (textoLimpo.length < 2) {
        setSugestoes([]);
        return;
      }

      if (modoBusca === 'Aluno') {
        const { data } = await supabase
          .from('alunos')
          .select('id, matricula, nome_completo, turmas(nome)')
          .or(
            `busca_otimizada.ilike.%${textoLimpo}%,matricula.ilike.%${textoLimpo}%`
          )
          .eq('ativo', true)
          .limit(5);

        if (data) {
          setSugestoes(
            data.map((a: any) => ({
              id: a.id,
              tipo: 'Aluno',
              matricula: a.matricula,
              nome_completo: a.nome_completo,
              detalhe: a.turmas?.nome || 'Sem turma',
            }))
          );
        }
      } else {
        const { data } = await supabase
          .from('funcionarios')
          .select('id, matricula, nome_completo, cargo')
          .or(
            `busca_otimizada.ilike.%${textoLimpo}%,matricula.ilike.%${textoLimpo}%`
          )
          .eq('ativo', true)
          .limit(5);

        if (data) {
          setSugestoes(
            data.map((f: any) => ({
              id: f.id,
              tipo: 'Funcionario',
              matricula: f.matricula,
              nome_completo: f.nome_completo,
              detalhe: f.cargo || 'Funcionário',
            }))
          );
        }
      }
    };

    const timer = setTimeout(buscarPessoas, 150);
    return () => clearTimeout(timer);
  }, [termo, modoBusca]);

  const adicionarAoHistorico = (tipo: string, nome: string, hora: string) => {
    const novoRegistro = { id: Date.now(), tipo, nome, hora };
    setHistorico((prev) => [novoRegistro, ...prev].slice(0, 5));
  };

  const registrarEntradaInterna = async (pessoa: PessoaListagem) => {
    try {
      setMensagemErro('');
      const { error } = await supabase.from('registros_acesso').insert([
        {
          tipo_pessoa: pessoa.tipo,
          pessoa_id: pessoa.id,
          operador_id: 'Portaria_Principal_Digitação',
          status_sincronizacao: 'sincronizado',
        },
      ]);

      if (error) throw error;

      const horaAtual = new Date().toLocaleTimeString('pt-BR');
      setConfirmacao({
        tipo: pessoa.tipo === 'Funcionario' ? 'Corpo Docente' : 'Aluno',
        nome: pessoa.nome_completo,
        detalhe: `Matrícula: ${pessoa.matricula} • ${pessoa.detalhe}`,
        hora: horaAtual,
      });

      adicionarAoHistorico(
        pessoa.tipo === 'Funcionario' ? 'Docente' : 'Aluno',
        pessoa.nome_completo,
        horaAtual
      );
      setTermo('');
      setSugestoes([]);
      setTimeout(() => setConfirmacao(null), 4000);
    } catch (err: any) {
      setMensagemErro('Erro ao registrar acesso: ' + err.message);
    }
  };

  const buscarVisitante = async () => {
    const buscaLimpa = termoVisitante.replace(/\D/g, '');
    if (!buscaLimpa) return;
    setBuscaVisitanteFeita(true);
    const { data } = await supabase
      .from('visitantes')
      .select('*')
      .or(`documento.ilike.%${buscaLimpa}%,telefone.ilike.%${buscaLimpa}%`)
      .limit(1);

    if (data && data.length > 0) setVisitanteEncontrado(data[0] as Visitante);
    else setVisitanteEncontrado(null);
  };

  const registrarEntradaVisitante = async (visitante: Visitante) => {
    try {
      setMensagemErro('');
      const { error } = await supabase.from('registros_acesso').insert([
        {
          tipo_pessoa: 'Visitante',
          pessoa_id: visitante.id,
          operador_id: 'Portaria_Principal_Digitação',
          status_sincronizacao: 'sincronizado',
        },
      ]);

      if (error) throw error;

      const horaAtual = new Date().toLocaleTimeString('pt-BR');
      setConfirmacao({
        tipo: 'Visitante',
        nome: visitante.nome_completo,
        detalhe: `Documento: ${visitante.documento} • ${
          visitante.empresa_origem || 'Acesso Geral'
        }`,
        hora: horaAtual,
      });

      adicionarAoHistorico('Visitante', visitante.nome_completo, horaAtual);
      setTermoVisitante('');
      setVisitanteEncontrado(null);
      setBuscaVisitanteFeita(false);
      setTimeout(() => setConfirmacao(null), 4000);
    } catch (err: any) {
      setMensagemErro('Erro ao registrar acesso: ' + err.message);
    }
  };

  const cadastrarERegistrarVisitante = async () => {
    if (!novoNomeVisitante.trim()) return alert('Informe o nome do visitante.');
    try {
      setMensagemErro('');
      const docLimpo = termoVisitante.replace(/\D/g, '');
      const { data, error } = await supabase
        .from('visitantes')
        .insert([
          {
            nome_completo: novoNomeVisitante,
            documento: docLimpo,
            empresa_origem: novaEmpresaVisitante || null,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      await registrarEntradaVisitante(data as Visitante);
      setNovoNomeVisitante('');
      setNovaEmpresaVisitante('');
    } catch (err: any) {
      setMensagemErro('Erro ao cadastrar visitante: ' + err.message);
    }
  };

  return (
    <div>
      {confirmacao && (
        <div className="mb-6 bg-green-600 text-white p-6 rounded-xl shadow-lg flex items-center justify-between animate-fade-in border-2 border-green-400">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-4xl shadow-inner">
              <span className="text-green-600">✓</span>
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-green-200 mb-1">
                {confirmacao.tipo} • Acesso Registrado às {confirmacao.hora}
              </p>
              <h3 className="text-3xl font-extrabold">{confirmacao.nome}</h3>
              <p className="text-base text-green-100 mt-1">
                {confirmacao.detalhe}
              </p>
            </div>
          </div>
          <div className="bg-green-800 px-6 py-3 rounded-lg border border-green-500 shadow text-center">
            <span className="block text-xs text-green-300 uppercase font-bold">
              Status
            </span>
            <span className="block text-xl font-bold">ENTRADA REGISTRADA</span>
          </div>
        </div>
      )}

      {mensagemErro && (
        <div className="mb-6 bg-red-100 border-l-4 border-red-600 text-red-800 p-4 rounded shadow-sm font-semibold">
          {mensagemErro}
        </div>
      )}

      <div className="flex gap-6">
        <div className="w-2/3 bg-white p-8 rounded-xl shadow-md border-t-4 border-blue-600 relative">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                Registro de Acesso Interno
              </h2>
              <p className="text-gray-500 mt-1">
                Selecione o grupo e busque por nome ou matrícula.
              </p>
            </div>
            <span className="bg-blue-100 text-blue-800 p-2 rounded text-xl">
              🔍
            </span>
          </div>

          {/* NOVO: Alternador de Busca (Alunos vs Docentes) */}
          <div className="flex gap-4 mb-5 border-b pb-4">
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-gray-700">
              <input
                type="radio"
                className="w-5 h-5 text-blue-600"
                checked={modoBusca === 'Aluno'}
                onChange={() => {
                  setModoBusca('Aluno');
                  setTermo('');
                }}
              />
              Alunos
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-gray-700">
              <input
                type="radio"
                className="w-5 h-5 text-blue-600"
                checked={modoBusca === 'Funcionario'}
                onChange={() => {
                  setModoBusca('Funcionario');
                  setTermo('');
                }}
              />
              Corpo Docente / Equipe
            </label>
          </div>

          <input
            ref={ref}
            type="text"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && sugestoes.length > 0)
                registrarEntradaInterna(sugestoes[0]);
            }}
            placeholder={`Buscar em ${
              modoBusca === 'Aluno' ? 'Alunos' : 'Corpo Docente'
            }...`}
            className="w-full text-2xl p-4 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all shadow-inner bg-gray-50"
          />

          {sugestoes.length > 0 && (
            <div className="absolute left-8 right-8 mt-2 bg-white border-2 border-blue-200 rounded-xl shadow-2xl overflow-hidden z-20 divide-y divide-gray-100">
              {sugestoes.map((pessoa, index) => (
                <div
                  key={pessoa.id}
                  onClick={() => registrarEntradaInterna(pessoa)}
                  className={`p-5 cursor-pointer flex justify-between items-center transition-colors hover:bg-blue-50 ${
                    index === 0 ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div>
                    <span className="font-bold text-gray-800 text-xl block">
                      {pessoa.nome_completo}
                    </span>
                    <span className="text-sm text-gray-500 font-medium">
                      Matrícula: {pessoa.matricula} • {pessoa.detalhe}
                    </span>
                  </div>
                  <span
                    className={`text-sm font-bold px-4 py-2 rounded-lg ${
                      index === 0
                        ? 'bg-blue-600 text-white shadow'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {index === 0 ? 'Pressione Enter ↵' : 'Registrar Entrada'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="w-1/3 bg-white p-8 rounded-xl shadow-md border-t-4 border-yellow-500 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  Portaria de Visitantes
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  Registro avulso na escola
                </p>
              </div>
              <span className="bg-yellow-100 text-yellow-800 p-2 rounded text-xl">
                👤
              </span>
            </div>

            <label className="block text-sm font-bold text-gray-700 mb-2">
              Buscar Documento (CPF/RG)
            </label>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={termoVisitante}
                onChange={(e) => setTermoVisitante(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && buscarVisitante()}
                placeholder="Ex: 12345678900"
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-yellow-500 bg-gray-50"
              />
              <button
                onClick={buscarVisitante}
                className="bg-yellow-500 text-white font-bold px-5 py-2 rounded-lg hover:bg-yellow-600 transition-colors shadow"
              >
                Buscar
              </button>
            </div>

            {buscaVisitanteFeita && visitanteEncontrado && (
              <div className="bg-yellow-50 border border-yellow-300 p-5 rounded-xl mb-4 shadow-sm">
                <span className="text-xs uppercase font-extrabold text-yellow-800 block mb-1">
                  Cadastro Localizado
                </span>
                <p className="font-extrabold text-gray-900 text-lg">
                  {visitanteEncontrado.nome_completo}
                </p>
                <p className="text-sm text-gray-600 font-medium mb-4">
                  {visitanteEncontrado.empresa_origem || 'Visitante Avulso'}
                </p>
                <button
                  onClick={() => registrarEntradaVisitante(visitanteEncontrado)}
                  className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition-colors shadow-md text-lg"
                >
                  Registrar Entrada
                </button>
              </div>
            )}

            {buscaVisitanteFeita && !visitanteEncontrado && (
              <div className="bg-gray-50 border-2 border-dashed border-gray-300 p-5 rounded-xl mb-4">
                <span className="text-xs uppercase font-extrabold text-gray-500 block mb-3">
                  Cadastro de Novo Visitante
                </span>
                <input
                  type="text"
                  placeholder="Nome Completo *"
                  value={novoNomeVisitante}
                  onChange={(e) => setNovoNomeVisitante(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg mb-3 text-sm focus:outline-none focus:border-yellow-500"
                />
                <input
                  type="text"
                  placeholder="Empresa / Motivo"
                  value={novaEmpresaVisitante}
                  onChange={(e) => setNovaEmpresaVisitante(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg mb-4 text-sm focus:outline-none focus:border-yellow-500"
                />
                <button
                  onClick={cadastrarERegistrarVisitante}
                  className="w-full bg-yellow-500 text-gray-900 font-extrabold py-3 rounded-lg hover:bg-yellow-600 transition-colors shadow text-sm"
                >
                  Salvar & Registrar Entrada
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white p-6 rounded-xl shadow-md border-t-4 border-gray-800">
        <h2 className="text-lg font-bold mb-4 text-gray-800 flex items-center gap-2">
          🕒 Monitoramento da Portaria (Últimos Registros)
        </h2>
        {historico.length === 0 ? (
          <div className="bg-gray-50 p-4 rounded border border-gray-200 text-center text-gray-500 font-medium">
            Nenhum acesso registrado no turno atual.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {historico.map((reg) => (
              <div
                key={reg.id}
                className="bg-white p-4 rounded-lg border-2 border-gray-100 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2 py-1 rounded inline-block mb-2 
                    ${
                      reg.tipo === 'Aluno'
                        ? 'bg-blue-100 text-blue-800'
                        : reg.tipo === 'Docente'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {reg.tipo}
                  </span>
                  <p className="font-bold text-gray-800 leading-tight line-clamp-2">
                    {reg.nome}
                  </p>
                </div>
                <div className="mt-3 text-sm font-bold text-gray-400 flex items-center gap-1 border-t pt-2">
                  <span>⏱️</span> {reg.hora}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

// ========================================================
// 📱 TERMINAL TOUCH (REGISTRO RÁPIDO - ALUNOS E EQUIPE)
// ========================================================
const InterfaceTablet = () => {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [grupoSelecionado, setGrupoSelecionado] = useState<{
    id: number;
    nome: string;
    tipo: 'Turma' | 'Equipe';
  } | null>(null);
  const [pessoasGrupo, setPessoasGrupo] = useState<PessoaListagem[]>([]);
  const [salvandoId, setSalvandoId] = useState<number | null>(null);
  const [sucessoId, setSucessoId] = useState<number | null>(null);

  useEffect(() => {
    const carregarTurmas = async () => {
      const { data } = await supabase.from('turmas').select('*').order('nome');
      if (data) setTurmas(data as Turma[]);
    };
    carregarTurmas();
  }, []);

  const selecionarTurma = async (turma: Turma) => {
    setGrupoSelecionado({ id: turma.id, nome: turma.nome, tipo: 'Turma' });
    const { data } = await supabase
      .from('alunos')
      .select('id, matricula, nome_completo')
      .eq('turma_id', turma.id)
      .eq('ativo', true)
      .order('nome_completo');

    if (data) {
      setPessoasGrupo(
        data.map((a: any) => ({
          id: a.id,
          tipo: 'Aluno',
          matricula: a.matricula,
          nome_completo: a.nome_completo,
          detalhe: '',
        }))
      );
    }
  };

  const selecionarCorpoDocente = async () => {
    setGrupoSelecionado({
      id: 0,
      nome: 'Corpo Docente e Equipe',
      tipo: 'Equipe',
    });
    const { data } = await supabase
      .from('funcionarios')
      .select('id, matricula, nome_completo, cargo')
      .eq('ativo', true)
      .order('nome_completo');

    if (data) {
      setPessoasGrupo(
        data.map((f: any) => ({
          id: f.id,
          tipo: 'Funcionario',
          matricula: f.matricula,
          nome_completo: f.nome_completo,
          detalhe: f.cargo,
        }))
      );
    }
  };

  const registrarAcessoIndividual = async (pessoa: PessoaListagem) => {
    if (salvandoId) return;

    try {
      setSalvandoId(pessoa.id);
      const { error } = await supabase.from('registros_acesso').insert([
        {
          tipo_pessoa: pessoa.tipo,
          pessoa_id: pessoa.id,
          operador_id: 'Terminal_Touch_Portaria',
          status_sincronizacao: 'sincronizado',
        },
      ]);

      if (error) throw error;

      setSucessoId(pessoa.id);
      setTimeout(() => setSucessoId(null), 2000);
    } catch (err: any) {
      alert('Erro ao registrar o acesso: ' + err.message);
    } finally {
      setSalvandoId(null);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-blue-600 min-h-[80vh] flex flex-col">
      {!grupoSelecionado ? (
        <div>
          <div className="text-center mb-10">
            <h2 className="text-4xl font-extrabold text-gray-800">
              Painel de Registro Rápido
            </h2>
            <p className="text-gray-500 mt-2 text-lg">
              Selecione o grupo para visualizar os perfis e registrar a entrada
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {/* NOVO: Botão dedicado ao Corpo Docente */}
            <button
              onClick={selecionarCorpoDocente}
              className="p-8 bg-gray-50 border-2 border-gray-300 text-gray-800 rounded-2xl shadow-sm hover:bg-gray-100 active:scale-95 transition-all flex flex-col justify-center items-center h-48 text-center"
            >
              <span className="text-3xl font-extrabold block mb-2">
                Corpo Docente
              </span>
              <span className="text-sm text-gray-600 font-bold uppercase tracking-wider bg-white px-3 py-1 rounded-full border">
                Equipe Escolar
              </span>
            </button>

            {/* Listagem das Turmas */}
            {turmas.map((turma) => (
              <button
                key={turma.id}
                onClick={() => selecionarTurma(turma)}
                className="p-8 bg-blue-50 border-2 border-blue-200 text-blue-900 rounded-2xl shadow-sm hover:bg-blue-100 hover:border-blue-400 active:scale-95 transition-all flex flex-col justify-center items-center h-48 text-center"
              >
                <span className="text-4xl font-extrabold block mb-2">
                  {turma.nome}
                </span>
                <span className="text-sm text-blue-600 font-bold uppercase tracking-wider bg-white px-3 py-1 rounded-full border">
                  {turma.turno}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          <div className="flex justify-between items-center mb-6 pb-6 border-b-2">
            <div>
              <span className="text-sm uppercase font-extrabold text-blue-600 tracking-wider">
                Grupo Selecionado
              </span>
              <h2 className="text-3xl font-extrabold text-gray-900">
                {grupoSelecionado.nome}
              </h2>
            </div>
            <button
              onClick={() => setGrupoSelecionado(null)}
              className="bg-gray-100 border border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors text-lg flex items-center gap-2"
            >
              <span>←</span> Voltar aos Grupos
            </button>
          </div>

          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 mb-6 text-center">
            <p className="text-lg text-blue-900 font-medium">
              Toque no perfil abaixo para{' '}
              <strong>registrar a entrada instantaneamente</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 overflow-y-auto pb-6">
            {pessoasGrupo.map((pessoa) => {
              const isSalvando = salvandoId === pessoa.id;
              const isSucesso = sucessoId === pessoa.id;

              return (
                <button
                  key={pessoa.id}
                  disabled={isSalvando || isSucesso}
                  onClick={() => registrarAcessoIndividual(pessoa)}
                  className={`p-6 rounded-2xl border-2 flex justify-between items-center text-left transition-all ${
                    isSucesso
                      ? 'bg-green-500 border-green-600 text-white shadow-xl scale-[1.02]'
                      : 'bg-white border-gray-200 text-gray-800 hover:border-blue-400 hover:shadow-md active:scale-95'
                  }`}
                >
                  <div>
                    <p className="font-extrabold text-xl mb-1">
                      {pessoa.nome_completo}
                    </p>
                    <p
                      className={`text-sm font-semibold ${
                        isSucesso ? 'text-green-100' : 'text-gray-400'
                      }`}
                    >
                      Matrícula: {pessoa.matricula}{' '}
                      {pessoa.detalhe ? `• ${pessoa.detalhe}` : ''}
                    </p>
                  </div>

                  {isSucesso ? (
                    <div className="bg-white text-green-700 px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm">
                      <span className="text-xl font-black">✓</span>
                      <span className="text-sm font-black uppercase tracking-wider">
                        Registrado
                      </span>
                    </div>
                  ) : isSalvando ? (
                    <span className="text-sm font-bold text-gray-400 px-4 py-2">
                      Registrando...
                    </span>
                  ) : (
                    <div className="bg-gray-50 border text-gray-500 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider">
                      Toque p/ Registrar
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
