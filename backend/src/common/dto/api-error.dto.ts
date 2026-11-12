import { ApiProperty } from '@nestjs/swagger';

/**
 * Corpo de erro do filtro global. Documentado no contrato para o front tipar
 * a leitura de qualquer falha da API.
 */
export class ApiErrorDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ description: 'Código estável do erro.', example: 'VALIDATION_ERROR' })
  code: string;

  @ApiProperty({ description: 'Mensagem em português, pronta para exibição.' })
  message: string;
}

/** Resposta de operações que só confirmam a execução. */
export class SuccessDto {
  @ApiProperty({ example: true })
  success: boolean;
}
