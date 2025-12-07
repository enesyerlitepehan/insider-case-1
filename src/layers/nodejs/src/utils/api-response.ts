import { ApiError } from '../enums/api.enum';
import { httpResponse } from './common';

type ResponseBody<T = any> = {
  message: string;
  data?: T;
};

export type ApiResponseData = {
  okResponse?: {
    message: string;
    data?: any;
  };
  errorResponse?: {
    statusCode: number;
    apiError: ApiError;
    errorMessage: string;
  };
};

//Generic Api Response class to be used in Api Requests
export class ApiResponse {
  public httpResponse;

  constructor() {
    this.httpResponse = new httpResponse();
  }

  createSuccessResponse<T = any>(
    statusCode: number,
    responseBody: ResponseBody<T>,
  ) {
    return this.httpResponse
      .statusCode(statusCode)
      .body({
        message: responseBody.message,
        ...(responseBody.data && { data: responseBody.data }),
      })
      .allowOnlyOptionsHeaders()
      .end();
  }

  createErrorResponse(statusCode: number, message?: string, error?: ApiError) {
    return this.httpResponse
      .statusCode(statusCode)
      .body({ message: message, error: error })
      .allowOnlyOptionsHeaders()
      .end();
  }

  createResponse(data: ApiResponseData) {
    if (data.errorResponse) {
      return this.createErrorResponse(
        data.errorResponse.statusCode ?? 500,
        data.errorResponse.errorMessage ?? '',
        data.errorResponse.apiError ?? ApiError.INTERNAL_SERVER_ERROR,
      );
    }
    if (data.okResponse) {
      return this.createSuccessResponse(200, {
        data: data.okResponse.data,
        message: data.okResponse.message,
      });
    }

    return this.createErrorResponse(
      500,
      'Missing data/error in response',
      ApiError.INTERNAL_SERVER_ERROR,
    );
  }
}
