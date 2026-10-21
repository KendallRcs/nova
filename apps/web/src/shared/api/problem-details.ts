export interface FieldProblem {
  pointer?: string | undefined;
  code?: string | undefined;
  message?: string | undefined;
}

export interface ProblemDetails {
  type?: string | undefined;
  title: string;
  status: number;
  detail: string;
  code?: string | undefined;
  errors?: FieldProblem[] | undefined;
  violations?: string[] | undefined;
}

export class ApiProblem extends Error {
  readonly problem: ProblemDetails;
  readonly retryAfterSeconds: number | null;

  constructor(problem: ProblemDetails, retryAfterSeconds: number | null = null) {
    super(problem.detail);
    this.name = 'ApiProblem';
    this.problem = problem;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function toApiProblem(response: Response, body: unknown): ApiProblem {
  const candidate = isRecord(body) ? body : {};
  const retryAfter = response.headers.get('retry-after');
  const parsedRetryAfter = retryAfter === null ? null : Number.parseInt(retryAfter, 10);

  return new ApiProblem(
    {
      type: readString(candidate.type),
      title: readString(candidate.title) ?? fallbackTitle(response.status),
      status: readNumber(candidate.status) ?? response.status,
      detail: readString(candidate.detail) ?? fallbackDetail(response.status),
      code: readString(candidate.code),
      errors: readFieldProblems(candidate.errors),
      violations: readStringArray(candidate.violations),
    },
    Number.isFinite(parsedRetryAfter) ? parsedRetryAfter : null,
  );
}

export function problemMessage(error: unknown): string {
  if (error instanceof ApiProblem) return error.problem.detail;
  return 'No pudimos comunicarnos con Nova. Revisa la conexión e inténtalo nuevamente.';
}

function fallbackTitle(status: number): string {
  if (status === 401) return 'Tu sesión no es válida';
  if (status === 403) return 'No tienes permiso';
  if (status === 409) return 'La información cambió';
  if (status === 422) return 'Revisa los datos ingresados';
  if (status === 429) return 'Espera antes de intentarlo otra vez';
  return 'No se pudo completar la solicitud';
}

function fallbackDetail(status: number): string {
  if (status === 401) return 'El usuario o la contraseña son incorrectos.';
  if (status === 403) return 'Tu cuenta no puede realizar esta acción.';
  if (status === 429) return 'Se hicieron demasiados intentos. Espera un momento.';
  return 'Inténtalo nuevamente. Si el problema continúa, comunícate con el administrador.';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((item): item is string => typeof item === 'string');
  return strings.length > 0 ? strings : undefined;
}

function readFieldProblems(value: unknown): FieldProblem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const problems = value.filter(isRecord).map((item) => ({
    pointer: readString(item.pointer),
    code: readString(item.code),
    message: readString(item.message),
  }));
  return problems.length > 0 ? problems : undefined;
}
