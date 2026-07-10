package com.biopresence.api.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GestionnaireExceptions {
  @ExceptionHandler(ExceptionIntrouvable.class)
  public ResponseEntity<Map<String, Object>> handleNotFound(ExceptionIntrouvable exception) {
    return build(HttpStatus.NOT_FOUND, exception.getMessage());
  }

  @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
  public ResponseEntity<Map<String, Object>> handleBadRequest(RuntimeException exception) {
    return build(HttpStatus.BAD_REQUEST, exception.getMessage());
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException exception) {
    Map<String, Object> body = new HashMap<>();
    body.put("status", 400);
    body.put("error", "Bad Request");
    body.put("message", "Validation error");
    Map<String, String> fields = new HashMap<>();
    for (FieldError fieldError : exception.getBindingResult().getFieldErrors()) {
      fields.put(fieldError.getField(), fieldError.getDefaultMessage());
    }
    body.put("fields", fields);
    return ResponseEntity.badRequest().body(body);
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<Map<String, Object>> handleGeneric(Exception exception) {
    return build(HttpStatus.INTERNAL_SERVER_ERROR, exception.getMessage() == null ? "Unexpected error" : exception.getMessage());
  }

  private ResponseEntity<Map<String, Object>> build(HttpStatus status, String message) {
    Map<String, Object> body = new HashMap<>();
    body.put("status", status.value());
    body.put("error", status.getReasonPhrase());
    body.put("message", message);
    return ResponseEntity.status(status).body(body);
  }
}
